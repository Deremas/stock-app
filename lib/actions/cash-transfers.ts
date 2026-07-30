"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { LedgerEntryType } from "@/generated/prisma/enums";

import type { ActionResult } from "@/lib/actions/common";
import {
  createDocumentNumber,
  getActionActorByPermission,
  getActionErrorMessage,
  normalizeOptionalString,
  parseInputDate,
  toDecimal,
} from "@/lib/actions/common";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/inventory-ledger";
import {
  cashTransferSchema,
  type CashTransferFormInput,
} from "@/lib/validation/cash-transfer";
import {
  assertSufficientFinanceBalance,
  calculateFinanceAccountBalance,
  getCashTransferPostings,
} from "@/lib/finance-ledger";

export async function createCashTransferAction(
  input: CashTransferFormInput,
): Promise<ActionResult> {
  const actor = await getActionActorByPermission("cash-transfers:manage");

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to move cash between accounts.",
    };
  }

  const parsed = cashTransferSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ?? "Cash transfer details are invalid.",
    };
  }

  const transferDate = parseInputDate(parsed.data.transferDate);

  if (!transferDate) {
    return {
      success: false,
      message: "Transfer date is invalid.",
    };
  }

  const note = normalizeOptionalString(parsed.data.note);

  try {
    const transferReference = await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findFirst({
        where: {
          id: parsed.data.branchId,
          isActive: true,
          userAssignments: {
            some: {
              userId: actor.id,
              isActive: true,
            },
          },
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!branch) {
        throw new Error("You do not have access to the selected branch.");
      }

      const [fromAccount, toAccount] = await Promise.all([
        tx.financeAccount.findFirst({
          where: {
            id: parsed.data.fromAccountId,
            branchId: branch.id,
            type: "CASH",
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            ledgerEntries: {
              select: {
                amount: true,
                direction: true,
              },
            },
          },
        }),
        tx.financeAccount.findFirst({
          where: {
            id: parsed.data.toAccountId,
            branchId: branch.id,
            type: "BANK",
            isActive: true,
          },
          select: {
            id: true,
            name: true,
          },
        }),
      ]);

      if (!fromAccount) {
        throw new Error("Selected cash account was not found.");
      }

      if (!toAccount) {
        throw new Error("Selected bank account was not found.");
      }

      const availableBalance = calculateFinanceAccountBalance(
        fromAccount.ledgerEntries,
      );
      assertSufficientFinanceBalance({
        accountName: fromAccount.name,
        amount: parsed.data.amount,
        availableBalance,
      });

      const transferNumber = createDocumentNumber("CTR", transferDate);
      const description = `Cash deposit ${transferNumber} from ${fromAccount.name} to ${toAccount.name}`;
      const postings = getCashTransferPostings(parsed.data.amount);

      await tx.ledgerEntry.createMany({
        data: [
          {
            entryDate: transferDate,
            branchId: branch.id,
            financeAccountId: fromAccount.id,
            direction: postings.from.direction,
            amount: toDecimal(postings.from.amount),
            entryType: LedgerEntryType.CASH_TRANSFER,
            referenceType: "CashTransfer",
            referenceId: transferNumber,
            description,
            ...(note ? { metadata: { note } } : {}),
          },
          {
            entryDate: transferDate,
            branchId: branch.id,
            financeAccountId: toAccount.id,
            direction: postings.to.direction,
            amount: toDecimal(postings.to.amount),
            entryType: LedgerEntryType.CASH_TRANSFER,
            referenceType: "CashTransfer",
            referenceId: transferNumber,
            description,
            ...(note ? { metadata: { note } } : {}),
          },
        ],
      });

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: "CASH_TRANSFER",
        entityType: "CashTransfer",
        entityId: transferNumber,
        branchId: branch.id,
        after: {
          transferNumber,
          fromAccountId: fromAccount.id,
          fromAccountName: fromAccount.name,
          toAccountId: toAccount.id,
          toAccountName: toAccount.name,
          amount: parsed.data.amount,
          note: note ?? null,
        },
      });

      return transferNumber;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    revalidatePath("/finance/accounts");
    revalidatePath("/finance/cash");
    revalidatePath("/finance/cash-transfers");
    revalidatePath("/finance/ledger");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Cash transfer ${transferReference} posted successfully.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(
        error,
        "Unable to record the cash transfer right now.",
      ),
    };
  }
}
