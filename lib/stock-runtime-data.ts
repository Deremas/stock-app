import { unstable_noStore as noStore } from "next/cache";

import { prisma } from "@/lib/prisma";

import { sumRows, toNumber } from "@/lib/data-runtime-utils";

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
    const [movements, activeBranches, activeProducts] = await Promise.all([
      prisma.stockMovement.findMany({
        where: {
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
      prisma.branch.findMany({
        where: {
          isActive: true,
          ...(branchId ? { id: branchId } : {}),
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
        },
      }),
      prisma.product.findMany({
        where: {
          isActive: true,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          minimumStockAlert: true,
        },
      }),
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
      }
    >();

    for (const branch of activeBranches) {
      for (const product of activeProducts) {
        const key = `${branch.id}:${product.id}`;

        summary.set(key, {
          id: key,
          branchId: branch.id,
          branch: branch.name,
          productId: product.id,
          product: product.name,
          ownedQty: 0,
          sellerQty: 0,
          assignedQty: 0,
          totalQty: 0,
          stockValue: 0,
          minimumStockAlert: product.minimumStockAlert,
        });
      }
    }

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
      };

      if (movement.ownershipType === "OWNED") {
        existing.ownedQty += movement.quantity;
      } else if (movement.ownershipType === "SELLER_CONSIGNMENT") {
        existing.sellerQty += movement.quantity;
      } else {
        existing.assignedQty += movement.quantity;
      }

      existing.totalQty += movement.quantity;
      existing.stockValue += movement.quantity * toNumber(movement.unitCost);
      summary.set(key, existing);
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
