import { prisma } from "@/lib/prisma";
import { getOwnedStockBatches } from "@/lib/owned-stock-batches";
import type { RowActionConfig, SimpleRow } from "@/lib/table";
import { toNumber } from "@/lib/data-runtime-utils";
import { getOpenSellerPayablesBySeller } from "@/lib/stock-runtime-data";

type SellerFilters = {
  sellerId?: string;
  branchId?: string;
};

function withFilter(path: string, params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

function createRowAction(action: RowActionConfig) {
  return action;
}

function createAssignHref(batchId: string) {
  const params = new URLSearchParams({
    batchId,
    open: "1",
  });

  return `/sellers/assign-items?${params.toString()}`;
}

export async function getSellerRows(branchId?: string) {
  const [sellers, intakeItems, assignmentItems, openPayables] = await Promise.all([
    prisma.seller.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        fullName: "asc",
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        address: true,
        note: true,
        isActive: true,
        intakes: {
          where: {
            ...(branchId ? { branchId } : {}),
          },
          select: {
            bringingDate: true,
          },
          orderBy: {
            bringingDate: "desc",
          },
          take: 1,
        },
      },
    }),
    prisma.sellerIntakeItem.findMany({
      where: {
        ...(branchId
          ? {
              sellerIntake: {
                branchId,
              },
            }
          : {}),
      },
      select: {
        quantityBrought: true,
        quantitySold: true,
        quantityReturned: true,
        sellerIntake: {
          select: {
            sellerId: true,
          },
        },
      },
    }),
    prisma.sellerAssignmentItem.findMany({
      where: {
        ...(branchId
          ? {
              sellerAssignment: {
                branchId,
              },
            }
          : {}),
      },
      select: {
        quantityAssigned: true,
        quantitySold: true,
        quantityReturned: true,
        sellerAssignment: {
          select: {
            sellerId: true,
          },
        },
      },
    }),
    getOpenSellerPayablesBySeller(branchId),
  ]);

  const onHandMap = new Map<string, number>();
  for (const item of intakeItems) {
    const onHand = item.quantityBrought - item.quantitySold - item.quantityReturned;
    onHandMap.set(
      item.sellerIntake.sellerId,
      (onHandMap.get(item.sellerIntake.sellerId) ?? 0) + onHand,
    );
  }

  for (const item of assignmentItems) {
    const onHand = item.quantityAssigned - item.quantitySold - item.quantityReturned;
    onHandMap.set(
      item.sellerAssignment.sellerId,
      (onHandMap.get(item.sellerAssignment.sellerId) ?? 0) + onHand,
    );
  }

  return sellers.map(
    (seller) =>
      ({
        id: seller.id,
        fullName: seller.fullName,
        phone: seller.phone,
        location: seller.address ?? "-",
        note: seller.note ?? "-",
        onHandQty: onHandMap.get(seller.id) ?? 0,
        payableAmount: openPayables.get(seller.id) ?? 0,
        lastIntakeAt: seller.intakes[0]?.bringingDate.toISOString() ?? "",
        status: seller.isActive ? "ACTIVE" : "INACTIVE",
        __actions: [
          ...((openPayables.get(seller.id) ?? 0) > 0
            ? [
                createRowAction({
                  key: "settlements",
                  label: "Settlements",
                  href: withFilter("/sellers/settlements", {
                    sellerId: seller.id,
                    q: seller.fullName,
                    open: "1",
                  }),
                  icon: "supplierPayments",
                }),
              ]
            : []),
          createRowAction({
            key: "intakes",
            label: "Received",
            href: withFilter("/sellers/intake-records", {
              sellerId: seller.id,
              q: seller.fullName,
            }),
            icon: "newPurchase",
          }),
          createRowAction({
            key: "assigned",
            label: "Assigned",
            href: withFilter("/sellers/assigned-items", {
              sellerId: seller.id,
              q: seller.fullName,
            }),
            icon: "cashTransfers",
          }),
          createRowAction({
            key: "returns",
            label: "Returns",
            href: withFilter("/sellers/returns", {
              sellerId: seller.id,
              q: seller.fullName,
            }),
            icon: "cashTransfers",
          }),
          createRowAction({
            key: "sold-items",
            label: "Sold Items",
            href: withFilter("/sales/sold-items", {
              sellerId: seller.id,
              q: seller.fullName,
            }),
            icon: "soldItems",
          }),
        ],
      }) satisfies SimpleRow,
  );
}

export async function getSellerIntakeRows(filters: SellerFilters = {}) {
  const rows = await prisma.sellerIntakeItem.findMany({
    where: {
      ...(filters.sellerId
        ? {
            sellerIntake: {
              ...(filters.branchId ? { branchId: filters.branchId } : {}),
              sellerId: filters.sellerId,
            },
          }
        : {}),
      ...(!filters.sellerId && filters.branchId
        ? {
            sellerIntake: {
              branchId: filters.branchId,
            },
          }
        : {}),
    },
    orderBy: {
      bringingDate: "desc",
    },
    include: {
      product: {
        select: {
          name: true,
        },
      },
      sellerIntake: {
        select: {
          intakeNumber: true,
          branch: {
            select: {
              name: true,
            },
          },
          seller: {
            select: {
              fullName: true,
            },
          },
        },
      },
    },
  });

  return rows.map(
    (row) =>
      ({
        id: row.id,
        intakeNumber: row.sellerIntake.intakeNumber,
        seller: row.sellerIntake.seller.fullName,
        branch: row.sellerIntake.branch.name,
        product: row.product.name,
        quantityBrought: row.quantityBrought,
        quantitySold: row.quantitySold,
        quantityReturned: row.quantityReturned,
        quantityRemaining:
          row.quantityBrought -
          row.quantitySold -
          row.quantityReturned -
          row.quantityAssigned,
        sellerFixedPrice: toNumber(row.sellerFixedPrice),
        bringingDate: row.bringingDate.toISOString(),
        status: "OPEN",
      }) satisfies SimpleRow,
  );
}

export async function getSellerAssignCandidateRows(branchId?: string) {
  const rows = await getOwnedStockBatches(branchId ? { branchId } : {});

  return rows.map(
    (row) =>
      ({
        id: row.id,
        branch: row.branchName,
        product: row.productName,
        referenceNumber: row.referenceNumber,
        source: row.sourceType,
        sourceName: row.sourceName,
        availableQty: row.remainingQuantity,
        unitCost: row.unitCost,
        sellingPrice: row.sellingPrice,
        status: "READY",
        __actions: [
          createRowAction({
            key: "assign",
            label: "Assign",
            href: createAssignHref(row.id),
            icon: "stockMovements",
          }),
        ],
      }) satisfies SimpleRow,
  );
}

export async function getSellerAssignedRows(filters: SellerFilters = {}) {
  const rows = await prisma.sellerAssignmentItem.findMany({
    where: {
      ...(filters.sellerId
        ? {
            sellerAssignment: {
              ...(filters.branchId ? { branchId: filters.branchId } : {}),
              sellerId: filters.sellerId,
            },
          }
        : {}),
      ...(!filters.sellerId && filters.branchId
        ? {
            sellerAssignment: {
              branchId: filters.branchId,
            },
          }
        : {}),
    },
    orderBy: {
      assignmentDate: "desc",
    },
    include: {
      product: {
        select: {
          name: true,
        },
      },
      sellerIntakeItem: {
        select: {
          sellerFixedPrice: true,
          sellerIntake: {
            select: {
              intakeNumber: true,
            },
          },
        },
      },
      purchaseItem: {
        select: {
          purchase: {
            select: {
              purchaseNumber: true,
            },
          },
        },
      },
      transferItem: {
        select: {
          transfer: {
            select: {
              transferNumber: true,
            },
          },
        },
      },
      sellerAssignment: {
        select: {
          assignmentNumber: true,
          branch: {
            select: {
              name: true,
            },
          },
          seller: {
            select: {
              fullName: true,
            },
          },
        },
      },
    },
  });

  return rows.map(
    (row) =>
      ({
        id: row.id,
        assignmentNumber: row.sellerAssignment.assignmentNumber,
        seller: row.sellerAssignment.seller.fullName,
        branch: row.sellerAssignment.branch.name,
        product: row.product.name,
        sourceBatch:
          row.purchaseItem?.purchase.purchaseNumber ??
          row.transferItem?.transfer.transferNumber ??
          row.sellerIntakeItem?.sellerIntake.intakeNumber ??
          "-",
        assignedPrice: toNumber(
          row.sellingPrice ?? row.sellerIntakeItem?.sellerFixedPrice ?? 0,
        ),
        unitCost: toNumber(
          row.unitCost ?? row.sellerIntakeItem?.sellerFixedPrice ?? 0,
        ),
        assignedQty: row.quantityAssigned,
        soldQty: row.quantitySold,
        returnedQty: row.quantityReturned,
        remainingQty: row.quantityAssigned - row.quantitySold - row.quantityReturned,
        assignedAt: row.assignmentDate.toISOString(),
        status:
          row.quantityAssigned - row.quantitySold - row.quantityReturned > 0
            ? "ACTIVE"
            : "CLOSED",
      }) satisfies SimpleRow,
  );
}

export async function getSellerReturnRows(filters: SellerFilters = {}) {
  const rows = await prisma.sellerReturnItem.findMany({
    where: {
      ...(filters.sellerId
        ? {
            sellerReturn: {
              ...(filters.branchId ? { branchId: filters.branchId } : {}),
              sellerId: filters.sellerId,
            },
          }
        : {}),
      ...(!filters.sellerId && filters.branchId
        ? {
            sellerReturn: {
              branchId: filters.branchId,
            },
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      product: {
        select: {
          name: true,
        },
      },
      sellerReturn: {
        select: {
          returnNumber: true,
          returnDate: true,
          branch: {
            select: {
              name: true,
            },
          },
          seller: {
            select: {
              fullName: true,
            },
          },
        },
      },
      sellerIntakeItem: {
        select: {
          bringingDate: true,
        },
      },
      sellerAssignmentItem: {
        select: {
          assignmentDate: true,
        },
      },
    },
  });

  return rows.map(
    (row) =>
      ({
        id: row.id,
        returnNumber: row.sellerReturn.returnNumber,
        seller: row.sellerReturn.seller.fullName,
        branch: row.sellerReturn.branch.name,
        product: row.product.name,
        quantity: row.quantity,
        bringingDate: (
          row.sellerIntakeItem?.bringingDate ?? row.sellerAssignmentItem?.assignmentDate
        )?.toISOString() ?? "",
        returnDate: row.sellerReturn.returnDate.toISOString(),
        status: "POSTED",
      }) satisfies SimpleRow,
  );
}

export async function getSellerSettlementRows(filters: SellerFilters = {}) {
  const rows = await prisma.sellerSettlement.findMany({
    where: {
      ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
    },
    orderBy: {
      settlementDate: "desc",
    },
    include: {
      seller: {
        select: {
          fullName: true,
        },
      },
      branch: {
        select: {
          name: true,
        },
      },
      financeAccount: {
        select: {
          name: true,
        },
      },
    },
  });

  return rows.map(
    (row) =>
      ({
        id: row.id,
        settlementNumber: row.settlementNumber,
        seller: row.seller.fullName,
        branch: row.branch.name,
        paymentMethod: row.paymentMethod,
        account: row.financeAccount?.name ?? "-",
        amount: toNumber(row.amount),
        settledAt: row.settlementDate.toISOString(),
        status: row.status,
      }) satisfies SimpleRow,
  );
}
