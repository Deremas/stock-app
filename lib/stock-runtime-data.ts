import { unstable_noStore as noStore } from "next/cache";

import { prisma } from "@/lib/prisma";

import { sumRows, toNumber } from "@/lib/data-runtime-utils";
import { getOwnedStockBatches } from "@/lib/owned-stock-batches";

export async function getOpenSellerPayablesBySeller(branchId?: string) {
  try {
    const allocations = await prisma.saleItemAllocation.findMany({
      where: {
        sourceType: {
          in: ["SELLER_CONSIGNMENT", "SELLER_ASSIGNED"],
        },
        ...(branchId
          ? {
              saleItem: {
                sale: {
                  branchId,
                },
              },
            }
          : {}),
      },
      select: {
        quantity: true,
        sellerAmount: true,
        sellerIntakeItem: {
          select: {
            sellerIntake: {
              select: {
                sellerId: true,
              },
            },
          },
        },
        sellerAssignmentItem: {
          select: {
            sellerIntakeItemId: true,
            sellerAssignment: {
              select: {
                sellerId: true,
              },
            },
          },
        },
        settlementAllocations: {
          select: {
            amount: true,
          },
        },
      },
    });

    const payables = new Map<string, number>();

    for (const allocation of allocations) {
      const sellerId =
        (allocation.sellerAssignmentItem?.sellerIntakeItemId
          ? allocation.sellerAssignmentItem.sellerAssignment.sellerId
          : undefined) ??
        allocation.sellerIntakeItem?.sellerIntake.sellerId;

      if (!sellerId) {
        continue;
      }

      const gross = toNumber(allocation.sellerAmount) * allocation.quantity;
      const settled = sumRows(
        allocation.settlementAllocations.map((item) => toNumber(item.amount)),
      );

      payables.set(sellerId, (payables.get(sellerId) ?? 0) + gross - settled);
    }

    return payables;
  } catch (error) {
    console.error("Unable to load open seller payables.", error);
    return new Map<string, number>();
  }
}

export async function getOpenSellerCollectionsBySeller(branchId?: string) {
  try {
    const allocations = await prisma.saleItemAllocation.findMany({
      where: {
        sourceType: "SELLER_ASSIGNED",
        ...(branchId
          ? {
              saleItem: {
                sale: {
                  branchId,
                },
              },
            }
          : {}),
      },
      select: {
        quantity: true,
        sellerAmount: true,
        sellerAssignmentItem: {
          select: {
            sellerIntakeItemId: true,
            sellerAssignment: {
              select: {
                sellerId: true,
              },
            },
          },
        },
        collectionAllocations: {
          select: {
            amount: true,
          },
        },
      },
    });

    const collections = new Map<string, number>();

    for (const allocation of allocations) {
      if (allocation.sellerAssignmentItem?.sellerIntakeItemId) {
        continue;
      }

      const sellerId = allocation.sellerAssignmentItem?.sellerAssignment.sellerId;

      if (!sellerId) {
        continue;
      }

      const gross = toNumber(allocation.sellerAmount) * allocation.quantity;
      const collected = sumRows(
        allocation.collectionAllocations.map((item) => toNumber(item.amount)),
      );

      collections.set(
        sellerId,
        (collections.get(sellerId) ?? 0) + gross - collected,
      );
    }

    return collections;
  } catch (error) {
    console.error("Unable to load open seller collections.", error);
    return new Map<string, number>();
  }
}

export async function getStockSummaryRows(branchId?: string) {
  noStore();

  try {
    const [movements, ownedBatches] = await Promise.all([
      prisma.stockMovement.findMany({
        where: {
          product: {
            isActive: true,
          },
          ...(branchId ? { branchId } : {}),
        },
        include: {
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              minimumStockAlert: true,
            },
          },
        },
        orderBy: {
          movementDate: "asc",
        },
      }),
      getOwnedStockBatches(branchId ? { branchId } : {}),
    ]);

    const summary = new Map<
      string,
      {
        id: string;
        branchId: string;
        branch: string;
        productId: string;
        product: string;
        ownedQty: number;
        sellerQty: number;
        assignedQty: number;
        totalQty: number;
        stockValue: number;
        minimumStockAlert: number;
        lastMovementDate: Date;
      }
    >();
    const ownedBatchTotals = new Map<
      string,
      { quantity: number; value: number; batch: (typeof ownedBatches)[number] }
    >();

    for (const movement of movements) {
      const key = `${movement.branchId}:${movement.productId}`;
      const existing = summary.get(key) ?? {
        id: key,
        branchId: movement.branchId,
        branch: movement.branch.name,
        productId: movement.productId,
        product: movement.product.name,
        ownedQty: 0,
        sellerQty: 0,
        assignedQty: 0,
        totalQty: 0,
        stockValue: 0,
        minimumStockAlert: movement.product.minimumStockAlert,
        lastMovementDate: movement.movementDate,
      };

      if (movement.ownershipType === "SELLER_CONSIGNMENT") {
        existing.sellerQty += movement.quantity;
      } else if (movement.ownershipType === "SELLER_ASSIGNED") {
        existing.assignedQty += movement.quantity;
      } else {
        // The movement ledger remains the quantity source of truth. This keeps
        // legacy opening/adjustment history intact even when those rows predate
        // purchase-batch allocation tracking.
        existing.ownedQty += movement.quantity;
      }

      if (movement.movementDate > existing.lastMovementDate) {
        existing.lastMovementDate = movement.movementDate;
      }

      if (movement.ownershipType === "SELLER_CONSIGNMENT") {
        existing.totalQty += movement.quantity;
        existing.stockValue += movement.quantity * toNumber(movement.unitCost);
      } else if (movement.ownershipType === "OWNED") {
        existing.totalQty += movement.quantity;
        existing.stockValue += movement.quantity * toNumber(movement.unitCost);
      }
      summary.set(key, existing);
    }

    for (const batch of ownedBatches) {
      const key = `${batch.branchId}:${batch.productId}`;
      const receivedAt = new Date(batch.receivedAt);
      const existing = summary.get(key);
      const batchTotal = ownedBatchTotals.get(key) ?? {
        quantity: 0,
        value: 0,
        batch,
      };

      batchTotal.quantity += batch.remainingQuantity;
      batchTotal.value += batch.remainingQuantity * batch.unitCost;
      ownedBatchTotals.set(key, batchTotal);

      if (!existing) {
        summary.set(key, {
        id: key,
        branchId: batch.branchId,
        branch: batch.branchName,
        productId: batch.productId,
        product: batch.productName,
        ownedQty: batch.remainingQuantity,
        sellerQty: 0,
        assignedQty: 0,
        totalQty: batch.remainingQuantity,
        stockValue: batch.remainingQuantity * batch.unitCost,
        minimumStockAlert: 0,
        lastMovementDate: receivedAt,
        });
        continue;
      }

      if (receivedAt > existing.lastMovementDate) {
        existing.lastMovementDate = receivedAt;
      }
    }

    for (const [key, batchTotal] of ownedBatchTotals) {
      const existing = summary.get(key);

      if (!existing || existing.ownedQty <= 0) {
        continue;
      }

      const ledgerOwnedValue = Math.max(existing.stockValue, 0);
      const ledgerAverageCost = ledgerOwnedValue / existing.ownedQty;
      const batchCoveredQuantity = Math.min(
        Math.max(existing.ownedQty, 0),
        batchTotal.quantity,
      );
      const uncoveredQuantity = Math.max(
        existing.ownedQty - batchCoveredQuantity,
        0,
      );
      const batchAverageCost =
        batchTotal.quantity > 0 ? batchTotal.value / batchTotal.quantity : 0;

      // Current batch prices apply only to stock covered by tracked batches.
      // Legacy uncovered stock keeps its ledger cost instead of being rewritten.
      existing.stockValue =
        batchCoveredQuantity * batchAverageCost +
        uncoveredQuantity * ledgerAverageCost;
    }

    return [...summary.values()].sort((left, right) => {
      if (left.branch === right.branch) {
        return left.product.localeCompare(right.product);
      }

      return left.branch.localeCompare(right.branch);
    });
  } catch (error) {
    console.error("Unable to load stock summary.", error);
    return [];
  }
}
