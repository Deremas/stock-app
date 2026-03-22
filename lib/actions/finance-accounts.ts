"use server";

import { revalidatePath } from "next/cache";

import { LedgerDirection, LedgerEntryType } from "@/generated/prisma/enums";

import type { ActionResult } from "@/lib/actions/common";
import {
  createDocumentNumber,
  getActionActorByPermission,
  getActionErrorMessage,
  normalizeOptionalString,
  toDecimal,
} from "@/lib/actions/common";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/inventory-ledger";
import {
  financeAccountSchema,
  type FinanceAccountFormInput,
} from "@/lib/validation/finance-account";

export async function createFinanceAccountAction(
  input: FinanceAccountFormInput,
): Promise<ActionResult> {
  const actor = await getActionActorByPermission("accounts:manage");

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to manage finance accounts.",
    };
  }

  const parsed = financeAccountSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ?? "Finance account details are invalid.",
    };
  }

  const accountName = parsed.data.type === "CASH" ? "Cash" : parsed.data.name;
  const bankName =
    parsed.data.type === "BANK" ? normalizeOptionalString(parsed.data.bankName) : null;
  const accountNumber =
    parsed.data.type === "BANK"
      ? normalizeOptionalString(parsed.data.accountNumber)
      : null;

  try {
    const accountReference = await prisma.$transaction(async (tx) => {
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

      if (parsed.data.type === "CASH") {
        const existingCashAccount = await tx.financeAccount.findFirst({
          where: {
            branchId: branch.id,
            type: "CASH",
            isActive: true,
          },
          select: {
            id: true,
          },
        });

        if (existingCashAccount) {
          throw new Error(
            "This branch already has its cash account. Use the single cash option for branch cash.",
          );
        }
      } else {
        const duplicateBankAccount = await tx.financeAccount.findFirst({
          where: {
            branchId: branch.id,
            type: "BANK",
            isActive: true,
            bankName: bankName ?? null,
            accountNumber: accountNumber ?? null,
          },
          select: {
            id: true,
          },
        });

        if (duplicateBankAccount) {
          throw new Error("This bank account already exists for the selected branch.");
        }
      }

      const code = createDocumentNumber(parsed.data.type === "BANK" ? "BNK" : "CSH");

      const account = await tx.financeAccount.create({
        data: {
          branchId: branch.id,
          code,
          name: accountName,
          type: parsed.data.type,
          ...(bankName ? { bankName } : {}),
          ...(accountNumber ? { accountNumber } : {}),
        },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
        },
      });

      if (parsed.data.initialBalance > 0) {
        await tx.ledgerEntry.create({
          data: {
            entryDate: new Date(),
            branchId: branch.id,
            financeAccountId: account.id,
            direction: LedgerDirection.DEBIT,
            amount: toDecimal(parsed.data.initialBalance),
            entryType: LedgerEntryType.OPENING_BALANCE,
            referenceType: "FinanceAccount",
            referenceId: account.id,
            description: `Opening balance for ${account.name}`,
          },
        });
      }

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: "FINANCE_ACCOUNT_CREATE",
        entityType: "FinanceAccount",
        entityId: account.id,
        branchId: branch.id,
        after: {
          code: account.code,
          name: account.name,
          type: account.type,
          bankName: bankName ?? null,
          accountNumber: accountNumber ?? null,
          initialBalance: parsed.data.initialBalance,
        },
      });

      return account.code;
    });

    revalidatePath("/finance/accounts");
    revalidatePath("/finance/cash");
    revalidatePath("/finance/ledger");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Finance account ${accountReference} created successfully.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(
        error,
        "Unable to create the finance account right now.",
      ),
    };
  }
}
