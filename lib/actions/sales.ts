"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import {
  LedgerDirection,
  LedgerEntryType,
  PaymentStatus,
  SalePaymentMethod,
  SalePaymentAllocationMethod,
  SaleStatus,
  StockMovementType,
  StockOwnershipType,
  TaxTreatment,
} from "@/generated/prisma/enums";

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
import { hasPermission } from "@/lib/rbac";
import { calculateTax, roundCurrency } from "@/lib/tax";
import {
  createAuditLog,
  createStockSnapshot,
  syncLowStockAlert,
} from "@/lib/services/inventory-ledger";
import { saleSchema, type SaleFormInput } from "@/lib/validation/sale";

type AllocationBatch = {
  id: string;
  kind: "purchase" | "transfer" | "sellerIntake" | "sellerAssignment";
  sourceType: "OWNED" | "SELLER_CONSIGNMENT" | "SELLER_ASSIGNED";
  available: number;
  movementDate: Date;
  purchaseItemId?: string | undefined;
  transferItemId?: string | undefined;
  sellerIntakeItemId?: string | undefined;
  sellerAssignmentItemId?: string | undefined;
  sellerFixedPrice?: number | undefined;
  unitCost?: number | undefined;
};

async function buildAllocationPlan(args: {
  tx: Prisma.TransactionClient;
  branchId: string;
  productId: string;
  requiredQuantity: number;
  selectedOwnedBatchId?: string | undefined;
}) {
  const [purchaseBatches, transferBatches, intakeBatches, assignmentBatches] =
    await Promise.all([
    args.tx.purchaseItem.findMany({
      where: {
        productId: args.productId,
        purchase: {
          branchId: args.branchId,
          status: "POSTED",
        },
      },
      include: {
        purchase: {
          select: {
            purchasedAt: true,
          },
        },
        saleAllocations: {
          select: {
            quantity: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    args.tx.transferItem.findMany({
      where: {
        productId: args.productId,
        transfer: {
          destinationBranchId: args.branchId,
          status: "RECEIVED",
        },
      },
      include: {
        transfer: {
          select: {
            receivedAt: true,
            sentAt: true,
            createdAt: true,
          },
        },
        saleAllocations: {
          select: {
            quantity: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    args.tx.sellerIntakeItem.findMany({
      where: {
        productId: args.productId,
        sellerIntake: {
          branchId: args.branchId,
        },
      },
      orderBy: {
        bringingDate: "asc",
      },
    }),
    args.tx.sellerAssignmentItem.findMany({
      where: {
        productId: args.productId,
        sellerAssignment: {
          branchId: args.branchId,
        },
      },
      include: {
        purchaseItem: {
          select: {
            id: true,
          },
        },
        transferItem: {
          select: {
            id: true,
          },
        },
        sellerIntakeItem: {
          select: {
            id: true,
            sellerFixedPrice: true,
          },
        },
      },
      orderBy: {
        assignmentDate: "asc",
      },
    }),
  ]);

  const allBatches: AllocationBatch[] = [
    ...purchaseBatches.map((batch) => ({
      id: batch.id,
      kind: "purchase" as const,
      sourceType: StockOwnershipType.OWNED,
      available:
        batch.quantity -
        batch.quantityTransferred -
        batch.saleAllocations.reduce((sum, allocation) => sum + allocation.quantity, 0),
      movementDate: batch.purchase.purchasedAt,
      purchaseItemId: batch.id,
      unitCost: Number(batch.unitCost),
    })),
    ...transferBatches.map((batch) => ({
      id: batch.id,
      kind: "transfer" as const,
      sourceType: StockOwnershipType.OWNED,
      available:
        batch.quantity -
        batch.quantityTransferred -
        batch.saleAllocations.reduce((sum, allocation) => sum + allocation.quantity, 0),
      movementDate:
        batch.transfer.receivedAt ??
        batch.transfer.sentAt ??
        batch.transfer.createdAt,
      transferItemId: batch.id,
      unitCost: Number(batch.unitCost ?? 0),
    })),
    ...intakeBatches.map((batch) => ({
      id: batch.id,
      kind: "sellerIntake" as const,
      sourceType: StockOwnershipType.SELLER_CONSIGNMENT,
      available:
        batch.quantityBrought -
        batch.quantityAssigned -
        batch.quantitySold -
        batch.quantityReturned,
      movementDate: batch.bringingDate,
      sellerIntakeItemId: batch.id,
      sellerFixedPrice: Number(batch.sellerFixedPrice),
    })),
    ...assignmentBatches.map((batch) => ({
      id: batch.id,
      kind: "sellerAssignment" as const,
      sourceType: StockOwnershipType.SELLER_ASSIGNED,
      available: batch.quantityAssigned - batch.quantitySold - batch.quantityReturned,
      movementDate: batch.assignmentDate,
      sellerAssignmentItemId: batch.id,
      sellerIntakeItemId: batch.sellerIntakeItem?.id,
      sellerFixedPrice: batch.sellerIntakeItem
        ? Number(
            batch.sellingPrice ?? batch.sellerIntakeItem.sellerFixedPrice,
          )
        : batch.sellingPrice !== null
          ? Number(batch.sellingPrice)
          : undefined,
      unitCost:
        batch.unitCost !== null
          ? Number(batch.unitCost)
          : batch.sellerIntakeItem
            ? Number(batch.sellerIntakeItem.sellerFixedPrice)
            : undefined,
    })),
  ]
    .filter((batch) => batch.available > 0)
    .sort((left, right) => left.movementDate.getTime() - right.movementDate.getTime());

  if (args.selectedOwnedBatchId) {
    const selectedBatch = allBatches.find((batch) => batch.id === args.selectedOwnedBatchId);

    if (!selectedBatch) {
      throw new Error("Selected batch is no longer available for this item.");
    }

    if (selectedBatch.available < args.requiredQuantity) {
      throw new Error(
        `Only ${selectedBatch.available} item(s) remain in the selected batch.`,
      );
    }

    return [
      {
        ...selectedBatch,
        available: args.requiredQuantity,
      },
    ];
  }

  const totalAvailable = allBatches.reduce((sum, batch) => sum + batch.available, 0);

  if (totalAvailable <= 0) {
    throw new Error("No quantity is available for this item in the selected branch.");
  }

  if (totalAvailable < args.requiredQuantity) {
    throw new Error(`Only ${totalAvailable} item(s) are available to sell right now.`);
  }

  const allocations: AllocationBatch[] = [];
  let remaining = args.requiredQuantity;

  for (const batch of allBatches) {
    if (remaining === 0) {
      break;
    }

    const quantity = Math.min(remaining, batch.available);
    remaining -= quantity;
    allocations.push({
      ...batch,
      available: quantity,
    });
  }

  return allocations;
}

export async function createSaleAction(
  input: SaleFormInput,
): Promise<ActionResult> {
  const actor = await getActionActor(["ADMIN", "SALES"]);

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to create sales.",
    };
  }

  const parsed = saleSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Sale payload did not validate.",
    };
  }

  const soldAt = parseInputDate(parsed.data.soldAt);

  if (!soldAt) {
    return {
      success: false,
      message: "Sale date is invalid.",
    };
  }

  const customerId = normalizeOptionalString(parsed.data.customerId);
  const financeAccountId = normalizeOptionalString(parsed.data.financeAccountId);
  const note = normalizeOptionalString(parsed.data.note);
  const requiresFinanceAccount =
    parsed.data.paymentMethod === "CASH" || parsed.data.paymentMethod === "BANK";
  const hasPaidPortion =
    parsed.data.paymentMethod !== "CREDIT" &&
    (parsed.data.paymentMethod !== "MIXED" ||
      parsed.data.mixedCashAmount > 0 ||
      parsed.data.mixedBankAmount > 0);

  if (hasPaidPortion && !hasPermission(actor.role, "accounts:use")) {
    return {
      success: false,
      message: "You are not allowed to use finance accounts for paid sales.",
    };
  }

  try {
    const saleReference = await prisma.$transaction(async (tx) => {
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
        select: { id: true },
      });

      if (!branch) {
        throw new Error("You do not have access to the selected branch.");
      }

      const financeAccount = financeAccountId
        ? await tx.financeAccount.findFirst({
            where: {
              id: financeAccountId,
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              branchId: true,
              type: true,
            },
          })
        : null;

      if (requiresFinanceAccount && !financeAccountId) {
        throw new Error("Select the finance account that received the sale.");
      }

      if (financeAccountId && !financeAccount) {
        throw new Error("Selected finance account was not found.");
      }

      if (
        requiresFinanceAccount &&
        financeAccount &&
        financeAccount.branchId &&
        financeAccount.branchId !== branch.id
      ) {
        throw new Error("Finance account must belong to the same branch as the sale.");
      }

      if (parsed.data.paymentMethod === "CASH" && financeAccount?.type !== "CASH") {
        throw new Error("Cash sales must be posted into the branch cash account.");
      }

      if (parsed.data.paymentMethod === "BANK" && financeAccount?.type !== "BANK") {
        throw new Error("Bank sales must be posted into a bank account.");
      }

      if (customerId) {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { id: true },
        });

        if (!customer) {
          throw new Error("Selected customer was not found.");
        }
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
          settings.salesVatEnabled &&
          Number(settings.defaultSalesVatRate) > 0,
      );
      const applyVat = vatAvailable && parsed.data.applyVat;
      const taxRate = applyVat ? Number(settings?.defaultSalesVatRate ?? 0) : 0;
      const priceMode = settings?.salesPriceMode ?? "EXCLUSIVE";
      const calculatedItems = parsed.data.items.map((item) => {
        const netUnitPrice = item.unitPrice - item.discount;

        if (netUnitPrice < 0) {
          throw new Error("Discount cannot exceed unit price.");
        }

        const enteredLineAmount = item.quantity * netUnitPrice - (item.fixedDiscount ?? 0);
        if (enteredLineAmount < 0) {
          throw new Error("Fixed discount cannot exceed the line item total.");
        }

        return {
          item,
          tax: calculateTax({
            amount: enteredLineAmount,
            enabled: applyVat,
            rate: taxRate,
            priceMode,
          }),
        };
      });
      const subtotal = calculatedItems.reduce((sum, line) => sum + line.tax.netAmount, 0);
      const taxAmount = calculatedItems.reduce((sum, line) => sum + line.tax.taxAmount, 0);
      const total = calculatedItems.reduce((sum, line) => sum + line.tax.total, 0);
      const requestedAllocations =
        parsed.data.paymentMethod === "MIXED"
          ? [
              ...(parsed.data.mixedCashAmount > 0
                ? [{
                    method: SalePaymentAllocationMethod.CASH,
                    amount: parsed.data.mixedCashAmount,
                    financeAccountId: normalizeOptionalString(parsed.data.mixedCashAccountId),
                  }]
                : []),
              ...(parsed.data.mixedBankAmount > 0
                ? [{
                    method: SalePaymentAllocationMethod.BANK,
                    amount: parsed.data.mixedBankAmount,
                    financeAccountId: normalizeOptionalString(parsed.data.mixedBankAccountId),
                  }]
                : []),
              ...(parsed.data.mixedCreditAmount > 0
                ? [{
                    method: SalePaymentAllocationMethod.CREDIT,
                    amount: parsed.data.mixedCreditAmount,
                    financeAccountId: undefined,
                  }]
                : []),
            ]
          : [{
              method:
                parsed.data.paymentMethod === "CREDIT"
                  ? SalePaymentAllocationMethod.CREDIT
                  : parsed.data.paymentMethod === "BANK"
                    ? SalePaymentAllocationMethod.BANK
                    : SalePaymentAllocationMethod.CASH,
              amount: total,
              financeAccountId,
            }];
      const allocatedTotal = roundCurrency(
        requestedAllocations.reduce((sum, allocation) => sum + allocation.amount, 0),
      );
      if (allocatedTotal !== roundCurrency(total)) {
        throw new Error(
          `Payment allocation must equal the sale total of ${roundCurrency(total).toFixed(2)}.`,
        );
      }

      const allocationAccountIds = requestedAllocations
        .map((allocation) => allocation.financeAccountId)
        .filter((id): id is string => Boolean(id));
      const allocationAccounts = await tx.financeAccount.findMany({
        where: { id: { in: allocationAccountIds }, isActive: true },
        select: { id: true, name: true, branchId: true, type: true },
      });
      const allocationAccountMap = new Map(
        allocationAccounts.map((account) => [account.id, account]),
      );
      for (const allocation of requestedAllocations) {
        if (allocation.method === SalePaymentAllocationMethod.CREDIT) {
          if (!customerId) {
            throw new Error("Select a customer for the credit portion of the sale.");
          }
          continue;
        }
        if (!allocation.financeAccountId) {
          throw new Error(`Select the ${allocation.method.toLowerCase()} account.`);
        }
        const account = allocationAccountMap.get(allocation.financeAccountId);
        if (!account) {
          throw new Error("One or more selected payment accounts are unavailable.");
        }
        if (account.branchId && account.branchId !== branch.id) {
          throw new Error("Payment accounts must belong to the sale branch.");
        }
        if (account.type !== allocation.method) {
          throw new Error(`${allocation.method} portions must use a ${allocation.method.toLowerCase()} account.`);
        }
      }
      const amountPaid = roundCurrency(
        requestedAllocations
          .filter((allocation) => allocation.method !== SalePaymentAllocationMethod.CREDIT)
          .reduce((sum, allocation) => sum + allocation.amount, 0),
      );
      const amountDue = roundCurrency(total - amountPaid);
      const paymentStatus =
        amountDue <= 0
          ? PaymentStatus.PAID
          : amountPaid <= 0
            ? PaymentStatus.UNPAID
            : PaymentStatus.PARTIAL;
      const saleNumber = createDocumentNumber("SAL", soldAt);

      const sale = await tx.sale.create({
        data: {
          saleNumber,
          branchId: branch.id,
          ...(customerId ? { customerId } : {}),
          createdById: actor.id,
          status: SaleStatus.COMPLETED,
          paymentMethod: parsed.data.paymentMethod as keyof typeof SalePaymentMethod,
          paymentStatus,
          subtotal: toDecimal(subtotal),
          discountTotal: toDecimal(
            parsed.data.items.reduce((sum, item) => sum + (item.quantity * item.discount) + (item.fixedDiscount ?? 0), 0),
          ),
          taxTreatment: applyVat ? TaxTreatment.STANDARD : TaxTreatment.NONE,
          taxRate: toDecimal(taxRate),
          taxableAmount: toDecimal(applyVat ? subtotal : 0),
          taxAmount: toDecimal(taxAmount),
          pricesIncludeTax: applyVat && priceMode === "INCLUSIVE",
          total: toDecimal(total),
          amountPaid: toDecimal(amountPaid),
          amountDue: toDecimal(amountDue),
          soldAt,
          ...(note ? { note } : {}),
        },
        select: {
          id: true,
          saleNumber: true,
        },
      });

      await tx.salePaymentAllocation.createMany({
        data: requestedAllocations.map((allocation) => ({
          saleId: sale.id,
          method: allocation.method,
          amount: toDecimal(allocation.amount),
          ...(allocation.financeAccountId
            ? { financeAccountId: allocation.financeAccountId }
            : {}),
        })),
      });

      for (const calculatedItem of calculatedItems) {
        const { item, tax } = calculatedItem;
        const product = productMap.get(item.productId);
        const selectedOwnedBatchId = normalizeOptionalString(item.ownedBatchId);

        if (!product) {
          throw new Error("Sale line references an unknown product.");
        }

        const netUnitPrice = tax.netAmount / item.quantity;
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: product.id,
            quantity: item.quantity,
            unitPrice: toDecimal(item.unitPrice),
            discount: toDecimal(item.discount),
            fixedDiscount: toDecimal(item.fixedDiscount ?? 0),
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

        const allocations = await buildAllocationPlan({
          tx,
          branchId: branch.id,
          productId: product.id,
          requiredQuantity: item.quantity,
          ...(selectedOwnedBatchId
            ? { selectedOwnedBatchId }
            : {}),
        });

        for (const allocation of allocations) {
          await tx.saleItemAllocation.create({
            data: {
              saleItemId: saleItem.id,
              sourceType: allocation.sourceType,
              quantity: allocation.available,
              ...(allocation.purchaseItemId
                ? { purchaseItemId: allocation.purchaseItemId }
                : {}),
              ...(allocation.transferItemId
                ? { transferItemId: allocation.transferItemId }
                : {}),
              ...(allocation.sellerIntakeItemId &&
              allocation.kind === "sellerIntake"
                ? { sellerIntakeItemId: allocation.sellerIntakeItemId }
                : {}),
              ...(allocation.sellerAssignmentItemId
                ? { sellerAssignmentItemId: allocation.sellerAssignmentItemId }
                : {}),
              ...(allocation.unitCost !== undefined
                ? { unitCost: toDecimal(allocation.unitCost) }
                : {}),
              ...(allocation.sellerFixedPrice !== undefined
                ? { sellerAmount: toDecimal(allocation.sellerFixedPrice) }
                : {}),
            },
          });

          if (allocation.kind === "sellerIntake" && allocation.sellerIntakeItemId) {
            await tx.sellerIntakeItem.update({
              where: { id: allocation.sellerIntakeItemId },
              data: {
                quantitySold: {
                  increment: allocation.available,
                },
              },
            });
          }

          if (allocation.kind === "sellerAssignment" && allocation.sellerAssignmentItemId) {
            await tx.sellerAssignmentItem.update({
              where: { id: allocation.sellerAssignmentItemId },
              data: {
                quantitySold: {
                  increment: allocation.available,
                },
              },
            });

            if (allocation.sellerIntakeItemId) {
              await tx.sellerIntakeItem.update({
                where: { id: allocation.sellerIntakeItemId },
                data: {
                  quantityAssigned: {
                    decrement: allocation.available,
                  },
                  quantitySold: {
                    increment: allocation.available,
                  },
                },
              });
            }
          }

          await tx.stockMovement.create({
            data: {
              branchId: branch.id,
              productId: product.id,
              movementType: StockMovementType.SALE,
              ownershipType: allocation.sourceType,
              quantity: -allocation.available,
              ...(allocation.unitCost !== undefined
                ? { unitCost: toDecimal(allocation.unitCost) }
                : {}),
              unitValue: toDecimal(netUnitPrice),
              movementDate: soldAt,
              sourceType: "Sale",
              sourceId: sale.id,
              sourceLineId: saleItem.id,
              counterpartyType: customerId ? "Customer" : "WalkIn",
              ...(customerId ? { counterpartyId: customerId } : {}),
            },
          });

          await createStockSnapshot(tx, {
            branchId: branch.id,
            productId: product.id,
            ownershipType: allocation.sourceType,
            snapshotDate: soldAt,
            sourceKey: sale.saleNumber,
          });
        }

        await syncLowStockAlert(tx, {
          branchId: branch.id,
          productId: product.id,
          threshold: product.minimumStockAlert,
          evaluatedAt: soldAt,
        });
      }

      for (const allocation of requestedAllocations) {
        if (
          allocation.method === SalePaymentAllocationMethod.CREDIT ||
          !allocation.financeAccountId
        ) {
          continue;
        }
        await tx.ledgerEntry.create({
          data: {
            entryDate: soldAt,
            branchId: branch.id,
            financeAccountId: allocation.financeAccountId,
            direction: LedgerDirection.DEBIT,
            amount: toDecimal(allocation.amount),
            entryType: LedgerEntryType.SALE,
            referenceType: "Sale",
            referenceId: sale.id,
            description: `Sale receipt for ${sale.saleNumber} (${allocation.method})`,
          },
        });
      }

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: "SALE_CREATE",
        entityType: "Sale",
        entityId: sale.id,
        branchId: branch.id,
        after: {
          saleNumber: sale.saleNumber,
          branchId: branch.id,
          customerId: customerId ?? null,
          subtotal,
          taxAmount,
          total,
          paymentMethod: parsed.data.paymentMethod,
          paymentAllocations: requestedAllocations.map((allocation) => ({
            method: allocation.method,
            amount: allocation.amount,
            financeAccountId: allocation.financeAccountId ?? null,
          })),
          itemCount: parsed.data.items.length,
        },
      });

      return sale.saleNumber;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    revalidatePath("/sales/new");
    revalidatePath("/sales/sales-list");
    revalidatePath("/sales/daily-check");
    revalidatePath("/inventory/stock-overview");
    revalidatePath("/inventory/bin-card");
    revalidatePath("/sellers/list");
    revalidatePath("/sellers/assigned-items");
    revalidatePath("/sellers/collections");
    revalidatePath("/sellers/settlements");
    revalidatePath("/reports/sellers");
    revalidatePath("/reports/tax");
    revalidatePath("/finance/accounts");
    revalidatePath("/finance/cash");
    revalidatePath("/finance/ledger");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Sale ${saleReference} posted successfully.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(
        error,
        "Unable to post the sale right now.",
      ),
    };
  }
}
