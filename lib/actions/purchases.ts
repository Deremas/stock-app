"use server";

import { revalidatePath } from "next/cache";

import {
  LedgerDirection,
  LedgerEntryType,
  PaymentStatus,
  PurchaseStatus,
  StockMovementType,
  StockOwnershipType,
} from "@/generated/prisma/enums";

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
import { hasPermission } from "@/lib/rbac";
import {
  createAuditLog,
  createStockSnapshot,
  syncLowStockAlert,
} from "@/lib/services/inventory-ledger";
import {
  purchaseSchema,
  type PurchaseFormInput,
} from "@/lib/validation/purchase";

export async function createPurchaseAction(
  input: PurchaseFormInput,
): Promise<ActionResult> {
  const actor = await getActionActorByPermission("purchases:create");

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to create purchases.",
    };
  }

  const parsed = purchaseSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ?? "Purchase payload did not validate.",
    };
  }

  const purchasedAt = parseInputDate(parsed.data.purchasedAt);

  if (!purchasedAt) {
    return {
      success: false,
      message: "Purchase date is invalid.",
    };
  }

  const paymentAccountId = normalizeOptionalString(parsed.data.paymentAccountId);
  const supplierId = normalizeOptionalString(parsed.data.supplierId);
  const note = normalizeOptionalString(parsed.data.note);

  if (parsed.data.settlementMode !== "UNPAID" && !hasPermission(actor.role, "accounts:use")) {
    return {
      success: false,
      message: "You are not allowed to use payment accounts for purchases.",
    };
  }

  try {
    const purchaseReference = await prisma.$transaction(async (tx) => {
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
        select: { id: true, name: true },
      });

      if (!branch) {
        throw new Error("You do not have access to the selected branch.");
      }

      const supplier = supplierId
        ? await tx.supplier.findUnique({
            where: { id: supplierId },
            select: { id: true, name: true },
          })
        : null;

      if (supplierId && !supplier) {
        throw new Error("Selected supplier was not found.");
      }

      if (!supplier && parsed.data.settlementMode !== "FULL") {
        throw new Error(
          "Choose a supplier for unpaid or partial purchases so the balance can be settled later.",
        );
      }

      const paymentAccount = paymentAccountId
        ? await tx.financeAccount.findUnique({
            where: { id: paymentAccountId },
            select: { id: true, name: true, branchId: true },
          })
        : null;

      if (parsed.data.settlementMode !== "UNPAID" && !paymentAccountId) {
        throw new Error("Select a payment account for the amount being paid now.");
      }

      if (paymentAccountId && !paymentAccount) {
        throw new Error("Selected payment account was not found.");
      }

      if (
        parsed.data.settlementMode !== "UNPAID" &&
        paymentAccount &&
        paymentAccount.branchId &&
        paymentAccount.branchId !== branch.id
      ) {
        throw new Error("Payment account must belong to the same branch as the purchase.");
      }

      const productIds = [...new Set(parsed.data.items.map((item) => item.productId))];
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          minimumStockAlert: true,
        },
      });

      if (products.length !== productIds.length) {
        throw new Error("One or more selected products no longer exist.");
      }

      const productMap = new Map(products.map((product) => [product.id, product]));
      const subtotal = parsed.data.items.reduce((sum, item) => {
        return sum + item.quantity * item.unitCost;
      }, 0);
      const amountPaid =
        parsed.data.settlementMode === "UNPAID"
          ? 0
          : parsed.data.settlementMode === "FULL"
            ? subtotal
            : parsed.data.amountPaid;
      const amountDue = Math.max(0, Number((subtotal - amountPaid).toFixed(2)));
      const paymentStatus =
        amountPaid <= 0
          ? PaymentStatus.UNPAID
          : amountDue === 0
            ? PaymentStatus.PAID
            : PaymentStatus.PARTIAL;
      const purchaseNumber = createDocumentNumber("PUR", purchasedAt);

      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          branchId: branch.id,
          ...(supplier ? { supplierId: supplier.id } : {}),
          createdById: actor.id,
          ...(amountPaid > 0 && paymentAccountId ? { paymentAccountId } : {}),
          status: PurchaseStatus.POSTED,
          paymentStatus,
          subtotal: toDecimal(subtotal),
          discount: toDecimal(0),
          tax: toDecimal(0),
          total: toDecimal(subtotal),
          amountPaid: toDecimal(amountPaid),
          amountDue: toDecimal(amountDue),
          purchasedAt,
          ...(note ? { note } : {}),
        },
        select: {
          id: true,
          purchaseNumber: true,
        },
      });

      for (const item of parsed.data.items) {
        const product = productMap.get(item.productId);

        if (!product) {
          throw new Error("Purchase line references an unknown product.");
        }

        const purchaseItem = await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            productId: product.id,
            quantity: item.quantity,
            unitCost: toDecimal(item.unitCost),
            sellingPrice: toDecimal(item.sellingPrice),
            lineTotal: toDecimal(item.quantity * item.unitCost),
          },
          select: {
            id: true,
          },
        });

        await tx.stockMovement.create({
          data: {
            branchId: branch.id,
            productId: product.id,
            movementType: StockMovementType.PURCHASE,
            ownershipType: StockOwnershipType.OWNED,
            quantity: item.quantity,
            unitCost: toDecimal(item.unitCost),
            unitValue: toDecimal(item.sellingPrice),
            movementDate: purchasedAt,
            sourceType: "Purchase",
            sourceId: purchase.id,
            sourceLineId: purchaseItem.id,
            counterpartyType: supplier ? "Supplier" : "DirectPurchase",
            ...(supplier ? { counterpartyId: supplier.id } : {}),
          },
        });

        await createStockSnapshot(tx, {
          branchId: branch.id,
          productId: product.id,
          ownershipType: StockOwnershipType.OWNED,
          snapshotDate: purchasedAt,
          sourceKey: purchase.purchaseNumber,
        });

        await syncLowStockAlert(tx, {
          branchId: branch.id,
          productId: product.id,
          threshold: product.minimumStockAlert,
          evaluatedAt: purchasedAt,
        });
      }

      if (amountPaid > 0 && paymentAccountId && paymentAccount && supplier) {
        const supplierPayment = await tx.supplierPayment.create({
          data: {
            paymentNumber: createDocumentNumber("SPM", purchasedAt),
            supplierId: supplier.id,
            purchaseId: purchase.id,
            branchId: branch.id,
            financeAccountId: paymentAccount.id,
            recordedById: actor.id,
            amount: toDecimal(amountPaid),
            paymentDate: purchasedAt,
            note: `Initial payment posted with purchase ${purchase.purchaseNumber}.`,
          },
          select: {
            id: true,
            paymentNumber: true,
          },
        });

        await tx.ledgerEntry.create({
          data: {
            entryDate: purchasedAt,
            branchId: branch.id,
            financeAccountId: paymentAccount.id,
            direction: LedgerDirection.CREDIT,
            amount: toDecimal(amountPaid),
            entryType: LedgerEntryType.SUPPLIER_PAYMENT,
            referenceType: "SupplierPayment",
            referenceId: supplierPayment.id,
            description: `Supplier payment ${supplierPayment.paymentNumber} for ${purchase.purchaseNumber}`,
          },
        });
      }

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: "PURCHASE_CREATE",
        entityType: "Purchase",
        entityId: purchase.id,
        branchId: branch.id,
        after: {
          purchaseNumber: purchase.purchaseNumber,
          branchId: branch.id,
          supplierId: supplier?.id ?? null,
          total: subtotal,
          paymentStatus,
          amountPaid,
          amountDue,
          itemCount: parsed.data.items.length,
        },
      });

      return purchase.purchaseNumber;
    });

    revalidatePath("/purchases/list");
    revalidatePath("/purchases/new");
    revalidatePath("/purchases/suppliers");
    revalidatePath("/purchases/supplier-payments");
    revalidatePath("/finance/accounts");
    revalidatePath("/finance/cash");
    revalidatePath("/finance/ledger");
    revalidatePath("/inventory/stock-overview");
    revalidatePath("/inventory/low-stock");
    revalidatePath("/inventory/out-of-stock");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Purchase ${purchaseReference} posted successfully.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(
        error,
        "Unable to post the purchase right now.",
      ),
    };
  }
}
