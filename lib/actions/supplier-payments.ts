"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { LedgerDirection, LedgerEntryType, PaymentStatus } from "@/generated/prisma/enums";

import type { ActionResult } from "@/lib/actions/common";
import {
  createDocumentNumber,
  getActionActorByPermission,
  getActionErrorMessage,
  normalizeOptionalString,
  parseInputDate,
  toDecimal,
} from "@/lib/actions/common";
import {
  assertSufficientFinanceBalance,
  calculateFinanceAccountBalance,
} from "@/lib/finance-ledger";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/inventory-ledger";
import {
  supplierPaymentSchema,
  type SupplierPaymentFormInput,
} from "@/lib/validation/supplier-payment";

export async function createSupplierPaymentAction(
  input: SupplierPaymentFormInput,
): Promise<ActionResult> {
  const actor = await getActionActorByPermission("accounts:manage");

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to record supplier payments.",
    };
  }

  const parsed = supplierPaymentSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ?? "Supplier payment details are invalid.",
    };
  }

  const paymentDate = parseInputDate(parsed.data.paymentDate);

  if (!paymentDate) {
    return {
      success: false,
      message: "Payment date is invalid.",
    };
  }

  const note = normalizeOptionalString(parsed.data.note);

  try {
    const paymentReference = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: {
          id: parsed.data.purchaseId,
          supplierId: parsed.data.supplierId,
          status: "POSTED",
          branch: {
            isActive: true,
            userAssignments: {
              some: {
                userId: actor.id,
                isActive: true,
              },
            },
          },
        },
        select: {
          id: true,
          purchaseNumber: true,
          supplierId: true,
          branchId: true,
          amountDue: true,
          amountPaid: true,
        },
      });

      if (!purchase) {
        throw new Error("Selected outstanding purchase was not found.");
      }

      const supplier = await tx.supplier.findFirst({
        where: {
          id: parsed.data.supplierId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!supplier) {
        throw new Error("Selected supplier was not found.");
      }

      const financeAccount = await tx.financeAccount.findFirst({
        where: {
          id: parsed.data.financeAccountId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          branchId: true,
          ledgerEntries: {
            select: {
              amount: true,
              direction: true,
            },
          },
        },
      });

      if (!financeAccount) {
        throw new Error("Selected payment account was not found.");
      }

      if (financeAccount.branchId && financeAccount.branchId !== purchase.branchId) {
        throw new Error(
          "Payment account must belong to the same branch as the outstanding purchase.",
        );
      }

      const currentDue = Number(purchase.amountDue);

      if (currentDue <= 0) {
        throw new Error("This purchase has no outstanding balance left to pay.");
      }

      const amount =
        parsed.data.settlementMode === "FULL" ? currentDue : parsed.data.amount;

      if (amount > currentDue) {
        throw new Error("Payment amount cannot exceed the outstanding balance.");
      }

      assertSufficientFinanceBalance({
        accountName: financeAccount.name,
        amount,
        availableBalance: calculateFinanceAccountBalance(
          financeAccount.ledgerEntries,
        ),
      });

      const nextAmountDue = Math.max(0, Number((currentDue - amount).toFixed(2)));
      const nextAmountPaid = Number((Number(purchase.amountPaid) + amount).toFixed(2));
      const paymentStatus =
        nextAmountDue === 0 ? PaymentStatus.PAID : PaymentStatus.PARTIAL;
      const paymentNumber = createDocumentNumber("SPM", paymentDate);

      const payment = await tx.supplierPayment.create({
        data: {
          paymentNumber,
          supplierId: supplier.id,
          purchaseId: purchase.id,
          branchId: purchase.branchId,
          financeAccountId: financeAccount.id,
          recordedById: actor.id,
          amount: toDecimal(amount),
          paymentDate,
          ...(note ? { note } : {}),
        },
        select: {
          id: true,
          paymentNumber: true,
        },
      });

      await tx.purchase.update({
        where: {
          id: purchase.id,
        },
        data: {
          amountPaid: toDecimal(nextAmountPaid),
          amountDue: toDecimal(nextAmountDue),
          paymentStatus,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          entryDate: paymentDate,
          branchId: purchase.branchId,
          financeAccountId: financeAccount.id,
          direction: LedgerDirection.CREDIT,
          amount: toDecimal(amount),
          entryType: LedgerEntryType.SUPPLIER_PAYMENT,
          referenceType: "SupplierPayment",
          referenceId: payment.id,
          description: `Supplier payment ${payment.paymentNumber} for ${purchase.purchaseNumber}`,
        },
      });

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: "SUPPLIER_PAYMENT",
        entityType: "SupplierPayment",
        entityId: payment.id,
        branchId: purchase.branchId,
        after: {
          paymentNumber: payment.paymentNumber,
          supplierId: supplier.id,
          supplierName: supplier.name,
          purchaseId: purchase.id,
          purchaseNumber: purchase.purchaseNumber,
          amount,
          settlementMode: parsed.data.settlementMode,
          remainingDue: nextAmountDue,
          financeAccountId: financeAccount.id,
          financeAccountName: financeAccount.name,
        },
      });

      return payment.paymentNumber;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    revalidatePath("/purchases/suppliers");
    revalidatePath("/purchases/list");
    revalidatePath("/purchases/supplier-payments");
    revalidatePath("/finance/accounts");
    revalidatePath("/finance/cash");
    revalidatePath("/finance/ledger");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Supplier payment ${paymentReference} posted successfully.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(
        error,
        "Unable to record the supplier payment right now.",
      ),
    };
  }
}
