"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import {
  PaymentStatus,
  PurchaseStatus,
  StockMovementType,
  StockOwnershipType,
  TaxTreatment,
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
import {
  assertSufficientFinanceBalance,
  calculateFinanceAccountBalance,
  getPurchasePaymentPosting,
} from "@/lib/finance-ledger";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { calculateTax } from "@/lib/tax";
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
        ? await tx.financeAccount.findFirst({
            where: { id: paymentAccountId, isActive: true },
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
      const settings = await tx.businessSettings.findUnique({
        where: { id: "default" },
      });
      const vatAvailable = Boolean(
        settings?.vatEnabled &&
          settings.purchaseVatEnabled &&
          Number(settings.defaultPurchaseVatRate) > 0,
      );
      const applyVat = vatAvailable && parsed.data.applyVat;
      const taxRate = applyVat ? Number(settings?.defaultPurchaseVatRate ?? 0) : 0;
      const priceMode = settings?.purchasePriceMode ?? "EXCLUSIVE";
      const vatTreatment = settings?.purchaseVatTreatment ?? "RECOVERABLE";
      const calculatedItems = parsed.data.items.map((item) => ({
        item,
        tax: calculateTax({
          amount: item.quantity * item.unitCost,
          enabled: applyVat,
          rate: taxRate,
          priceMode,
        }),
      }));
      const subtotal = calculatedItems.reduce((sum, line) => sum + line.tax.netAmount, 0);
      const taxAmount = calculatedItems.reduce((sum, line) => sum + line.tax.taxAmount, 0);
      const total = calculatedItems.reduce((sum, line) => sum + line.tax.total, 0);
      const amountPaid =
        parsed.data.settlementMode === "UNPAID"
          ? 0
          : parsed.data.settlementMode === "FULL"
            ? total
            : parsed.data.amountPaid;
      if (amountPaid > total) {
        throw new Error("Amount paid cannot exceed the purchase total.");
      }
      const amountDue = Math.max(0, Number((total - amountPaid).toFixed(2)));
      const paymentStatus =
        amountPaid <= 0
          ? PaymentStatus.UNPAID
          : amountDue === 0
            ? PaymentStatus.PAID
            : PaymentStatus.PARTIAL;

      if (amountPaid > 0 && paymentAccount) {
        assertSufficientFinanceBalance({
          accountName: paymentAccount.name,
          amount: amountPaid,
          availableBalance: calculateFinanceAccountBalance(
            paymentAccount.ledgerEntries,
          ),
        });
      }

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
          tax: toDecimal(taxAmount),
          taxTreatment: applyVat ? TaxTreatment.STANDARD : TaxTreatment.NONE,
          taxRate: toDecimal(taxRate),
          taxableAmount: toDecimal(applyVat ? subtotal : 0),
          pricesIncludeTax: applyVat && priceMode === "INCLUSIVE",
          vatTreatment,
          total: toDecimal(total),
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

      for (const calculatedItem of calculatedItems) {
        const { item, tax } = calculatedItem;
        const product = productMap.get(item.productId);

        if (!product) {
          throw new Error("Purchase line references an unknown product.");
        }

        const inventoryLineCost =
          applyVat && vatTreatment === "NON_RECOVERABLE" ? tax.total : tax.netAmount;
        const inventoryUnitCost = inventoryLineCost / item.quantity;
        const purchaseItem = await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            productId: product.id,
            quantity: item.quantity,
            unitCost: toDecimal(inventoryUnitCost),
            sellingPrice: toDecimal(item.sellingPrice),
            lineTotal: toDecimal(tax.netAmount),
            taxTreatment: tax.taxTreatment,
            taxRate: toDecimal(tax.taxRate),
            taxableAmount: toDecimal(tax.taxableAmount),
            taxAmount: toDecimal(tax.taxAmount),
            pricesIncludeTax: tax.pricesIncludeTax,
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
            unitCost: toDecimal(inventoryUnitCost),
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

      if (amountPaid > 0 && paymentAccountId && paymentAccount) {
        const supplierPayment = supplier
          ? await tx.supplierPayment.create({
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
            })
          : null;
        const paymentPosting = getPurchasePaymentPosting({
          amount: amountPaid,
          purchaseId: purchase.id,
          supplierPayment,
        });

        await tx.ledgerEntry.create({
          data: {
            entryDate: purchasedAt,
            branchId: branch.id,
            financeAccountId: paymentAccount.id,
            direction: paymentPosting.direction,
            amount: toDecimal(paymentPosting.amount),
            entryType: paymentPosting.entryType,
            referenceType: paymentPosting.referenceType,
            referenceId: paymentPosting.referenceId,
            description: supplierPayment
              ? `Supplier payment ${supplierPayment.paymentNumber} for ${purchase.purchaseNumber}`
              : `Direct purchase payment for ${purchase.purchaseNumber}`,
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
          subtotal,
          taxAmount,
          total,
          paymentStatus,
          amountPaid,
          amountDue,
          itemCount: parsed.data.items.length,
        },
      });

      return purchase.purchaseNumber;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    revalidatePath("/purchases/list");
    revalidatePath("/purchases/new");
    revalidatePath("/purchases/suppliers");
    revalidatePath("/purchases/supplier-payments");
    revalidatePath("/finance/accounts");
    revalidatePath("/finance/cash");
    revalidatePath("/finance/ledger");
    revalidatePath("/inventory/stock-overview");
    revalidatePath("/inventory/bin-card");
    revalidatePath("/inventory/low-stock");
    revalidatePath("/inventory/out-of-stock");
    revalidatePath("/dashboard");
    revalidatePath("/reports/tax");

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
