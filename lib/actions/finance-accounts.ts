"use server";

import { revalidatePath } from "next/cache";

import { LedgerDirection, LedgerEntryType } from "@/generated/prisma/enums";

import type { ActionResult } from "@/lib/actions/common";
import {
  createDocumentNumber,
  getActionActor,
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
  const actor = await getActionActor(["ADMIN"]);

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

  const bankName = normalizeOptionalString(parsed.data.bankName);
  const accountNumber = normalizeOptionalString(parsed.data.accountNumber);

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

      const duplicate = await tx.financeAccount.findFirst({
        where: {
          branchId: branch.id,
          type: parsed.data.type,
          OR: [
            {
              name: parsed.data.name,
            },
            ...(accountNumber
              ? [
                  {
                    accountNumber,
                  },
                ]
              : []),
          ],
        },
        select: {
          id: true,
        },
      });

      if (duplicate) {
        throw new Error("A similar active finance account already exists for this branch.");
      }

      const code = createDocumentNumber(parsed.data.type === "BANK" ? "BNK" : "CSH");

      const account = await tx.financeAccount.create({
        data: {
          branchId: branch.id,
          code,
          name: parsed.data.name,
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
