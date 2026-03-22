"use server";

import { revalidatePath } from "next/cache";

import { LedgerDirection, LedgerEntryType } from "@/generated/prisma/enums";

import type { ActionResult } from "@/lib/actions/common";
import {
  createDocumentNumber,
  getActionActor,
  getActionErrorMessage,
  normalizeOptionalString,
  parseInputDate,
  toDecimal,
} from "@/lib/actions/common";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/inventory-ledger";
import { expenseSchema, type ExpenseFormInput } from "@/lib/validation/expense";

export async function createExpenseAction(
  input: ExpenseFormInput,
): Promise<ActionResult> {
  const actor = await getActionActor(["ADMIN"]);

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to record expenses.",
    };
  }

  const parsed = expenseSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ?? "Expense details are invalid.",
    };
  }

  const expenseDate = parseInputDate(parsed.data.expenseDate);

  if (!expenseDate) {
    return {
      success: false,
      message: "Expense date is invalid.",
    };
  }

  const note = normalizeOptionalString(parsed.data.note);

  try {
    const expenseReference = await prisma.$transaction(async (tx) => {
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

      const financeAccount = await tx.financeAccount.findFirst({
        where: {
          id: parsed.data.financeAccountId,
          branchId: branch.id,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!financeAccount) {
        throw new Error("Selected payment account was not found.");
      }

      const category = await tx.expenseCategory.upsert({
        where: {
          name: parsed.data.categoryName,
        },
        update: {
          isActive: true,
        },
        create: {
          name: parsed.data.categoryName,
        },
        select: {
          id: true,
          name: true,
        },
      });

      const expenseNumber = createDocumentNumber("EXP", expenseDate);
      const expense = await tx.expense.create({
        data: {
          expenseNumber,
          branchId: branch.id,
          financeAccountId: financeAccount.id,
          expenseCategoryId: category.id,
          createdById: actor.id,
          name: parsed.data.name,
          amount: toDecimal(parsed.data.amount),
          expenseDate,
          ...(note ? { note } : {}),
        },
        select: {
          id: true,
          expenseNumber: true,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          entryDate: expenseDate,
          branchId: branch.id,
          financeAccountId: financeAccount.id,
          direction: LedgerDirection.CREDIT,
          amount: toDecimal(parsed.data.amount),
          entryType: LedgerEntryType.EXPENSE,
          referenceType: "Expense",
          referenceId: expense.id,
          description: `Expense ${expense.expenseNumber} - ${parsed.data.name}`,
        },
      });

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: "EXPENSE_CREATE",
        entityType: "Expense",
        entityId: expense.id,
        branchId: branch.id,
        after: {
          expenseNumber: expense.expenseNumber,
          categoryId: category.id,
          categoryName: category.name,
          name: parsed.data.name,
          amount: parsed.data.amount,
          financeAccountId: financeAccount.id,
          financeAccountName: financeAccount.name,
          note: note ?? null,
        },
      });

      return expense.expenseNumber;
    });

    revalidatePath("/finance/expenses");
    revalidatePath("/finance/ledger");
    revalidatePath("/reports/finance");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Expense ${expenseReference} posted successfully.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(
        error,
        "Unable to record the expense right now.",
      ),
    };
  }
}
