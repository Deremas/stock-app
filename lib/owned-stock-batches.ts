import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/lib/rbac";
import type { OwnedStockBatchOption } from "@/lib/types";
import { calculateBatchQuantityAdjustment } from "@/lib/inventory-adjustments";

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

export async function getOwnedStockBatches(
  input: {
    branchId?: string;
    branchIds?: string[];
    productId?: string;
    batchIds?: string[];
    role?: AppRole;
  } = {},
): Promise<OwnedStockBatchOption[]> {
  const role = input.role ?? "SALES";
  const isAdmin = role === "ADMIN";
  const [purchaseBatches, transferBatches] = await Promise.all([
    prisma.purchaseItem.findMany({
      where: {
        ...(input.productId ? { productId: input.productId } : {}),
        ...(input.batchIds?.length
          ? {
              id: {
                in: input.batchIds,
              },
            }
          : {}),
        purchase: {
          status: "POSTED",
          ...(input.branchId ? { branchId: input.branchId } : {}),
          ...(input.branchIds?.length
            ? {
                branchId: {
                  in: input.branchIds,
                },
              }
            : {}),
        },
      },
      orderBy: [{ purchase: { purchasedAt: "asc" } }, { createdAt: "asc" }],
      select: {
        id: true,
        productId: true,
        quantity: true,
        quantityAdjustment: true,
        quantityTransferred: true,
        unitCost: true,
        sellingPrice: true,
        saleAllocations: {
          select: {
            quantity: true,
          },
        },
        product: {
          select: {
            name: true,
          },
        },
        purchase: {
          select: {
            branchId: true,
            purchasedAt: true,
            purchaseNumber: true,
            branch: {
              select: {
                name: true,
              },
            },
            supplier: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.transferItem.findMany({
      where: {
        ...(input.productId ? { productId: input.productId } : {}),
        ...(input.batchIds?.length
          ? {
              id: {
                in: input.batchIds,
              },
            }
          : {}),
        transfer: {
          status: "RECEIVED",
          ...(input.branchId ? { destinationBranchId: input.branchId } : {}),
          ...(input.branchIds?.length
            ? {
                destinationBranchId: {
                  in: input.branchIds,
                },
              }
            : {}),
        },
      },
      orderBy: [{ transfer: { receivedAt: "asc" } }, { createdAt: "asc" }],
      select: {
        id: true,
        productId: true,
        quantity: true,
        quantityAdjustment: true,
        quantityTransferred: true,
        unitCost: true,
        sellingPrice: true,
        saleAllocations: {
          select: {
            quantity: true,
          },
        },
        product: {
          select: {
            name: true,
          },
        },
        transfer: {
          select: {
            transferNumber: true,
            sentAt: true,
            receivedAt: true,
            destinationBranchId: true,
            destinationBranch: {
              select: {
                name: true,
              },
            },
            sourceBranch: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const normalizedPurchaseBatches = purchaseBatches.map((batch) => {
    const soldQuantity = batch.saleAllocations.reduce(
      (sum, allocation) => sum + allocation.quantity,
      0,
    );
    const transferredQuantity = batch.quantityTransferred;
    const {
      adjustedQuantityAfter: adjustedQuantity,
      remainingAfter: remainingQuantity,
    } = calculateBatchQuantityAdjustment({
      originalQuantity: batch.quantity,
      existingAdjustment: batch.quantityAdjustment,
      soldQuantity,
      transferredQuantity,
      quantityDelta: 0,
    });

    return {
      id: batch.id,
      branchId: batch.purchase.branchId,
      branchName: batch.purchase.branch.name,
      productId: batch.productId,
      productName: batch.product.name,
      sourceType: "PURCHASE" as const,
      referenceNumber: batch.purchase.purchaseNumber,
      sourceName: batch.purchase.supplier?.name ?? "No supplier",
      receivedAt: batch.purchase.purchasedAt.toISOString(),
      quantity: batch.quantity,
      quantityAdjustment: batch.quantityAdjustment,
      adjustedQuantity,
      soldQuantity,
      transferredQuantity,
      remainingQuantity,
      unitCost: toNumber(batch.unitCost),
      sellingPrice: toNumber(batch.sellingPrice),
    } satisfies OwnedStockBatchOption;
  });

  const normalizedTransferBatches = transferBatches.map((batch) => {
    const soldQuantity = batch.saleAllocations.reduce(
      (sum, allocation) => sum + allocation.quantity,
      0,
    );
    const transferredQuantity = batch.quantityTransferred;
    const {
      adjustedQuantityAfter: adjustedQuantity,
      remainingAfter: remainingQuantity,
    } = calculateBatchQuantityAdjustment({
      originalQuantity: batch.quantity,
      existingAdjustment: batch.quantityAdjustment,
      soldQuantity,
      transferredQuantity,
      quantityDelta: 0,
    });

    return {
      id: batch.id,
      branchId: batch.transfer.destinationBranchId,
      branchName: batch.transfer.destinationBranch.name,
      productId: batch.productId,
      productName: batch.product.name,
      sourceType: "TRANSFER" as const,
      referenceNumber: batch.transfer.transferNumber,
      sourceName: batch.transfer.sourceBranch.name,
      receivedAt: (
        batch.transfer.receivedAt ??
        batch.transfer.sentAt ??
        new Date()
      ).toISOString(),
      quantity: batch.quantity,
      quantityAdjustment: batch.quantityAdjustment,
      adjustedQuantity,
      soldQuantity,
      transferredQuantity,
      remainingQuantity,
      unitCost: toNumber(batch.unitCost),
      sellingPrice: toNumber(batch.sellingPrice),
    } satisfies OwnedStockBatchOption;
  });

  return [...normalizedPurchaseBatches, ...normalizedTransferBatches]
    .filter((batch) => batch.remainingQuantity > 0)
    .sort((left, right) => {
      const dateDiff =
        new Date(left.receivedAt).getTime() - new Date(right.receivedAt).getTime();

      if (dateDiff !== 0) {
        return dateDiff;
      }

      if (left.branchName === right.branchName) {
        return left.referenceNumber.localeCompare(right.referenceNumber);
      }

      return left.branchName.localeCompare(right.branchName);
    });
}
