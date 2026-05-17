import { endOfDay, parseISO } from "date-fns";

import { formatFinanceAccountLabel } from "@/lib/finance-account-utils";
import { prisma } from "@/lib/prisma";
import { getOwnedStockBatches } from "@/lib/owned-stock-batches";
import type { RowActionConfig, SimpleRow } from "@/lib/table";
import { toNumber } from "@/lib/data-runtime-utils";
import {
  getOpenSellerCollectionsBySeller,
  getOpenSellerPayablesBySeller,
} from "@/lib/stock-runtime-data";
import { formatCurrency } from "@/lib/utils";
import type { AppRole } from "@/lib/rbac";

type SellerFilters = {
  sellerId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
};

function getDateRangeFilter(filters: Pick<SellerFilters, "dateFrom" | "dateTo">) {
  if (!filters.dateFrom && !filters.dateTo) {
    return undefined;
  }

  const range: {
    gte?: Date;
    lte?: Date;
  } = {};

  if (filters.dateFrom) {
    const parsedDate = parseISO(filters.dateFrom);

    if (!Number.isNaN(parsedDate.getTime())) {
      range.gte = parsedDate;
    }
  }

  if (filters.dateTo) {
    const parsedDate = parseISO(filters.dateTo);

    if (!Number.isNaN(parsedDate.getTime())) {
      range.lte = endOfDay(parsedDate);
    }
  }

  return Object.keys(range).length > 0 ? range : undefined;
}

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

function createReceiveHref(sellerId?: string, sellerName?: string) {
  return withFilter("/sellers/intake-records", {
    ...(sellerId ? { sellerId } : {}),
    ...(sellerName ? { q: sellerName } : {}),
    open: "1",
  });
}

function createAssignHref(batchId?: string, sellerId?: string) {
  return withFilter("/sellers/assign-items", {
    ...(batchId ? { batchId } : {}),
    ...(sellerId ? { sellerId } : {}),
    open: "1",
  });
}

function createSellerOverviewHref(sellerId: string, branchId?: string) {
  return withFilter(`/sellers/${sellerId}`, {
    ...(branchId ? { branchId } : {}),
  });
}

function createReturnHref(params: {
  sellerId?: string;
  sellerName?: string;
  intakeItemId?: string;
  assignmentItemId?: string;
}) {
  return withFilter("/sellers/returns", {
    ...(params.sellerId ? { sellerId: params.sellerId } : {}),
    ...(params.sellerName ? { q: params.sellerName } : {}),
    ...(params.intakeItemId ? { intakeItemId: params.intakeItemId } : {}),
    ...(params.assignmentItemId ? { assignmentItemId: params.assignmentItemId } : {}),
    open: "1",
  });
}

function createSettlementHref(sellerId?: string, sellerName?: string) {
  return withFilter("/sellers/settlements", {
    ...(sellerId ? { sellerId } : {}),
    ...(sellerName ? { q: sellerName } : {}),
    open: "1",
  });
}

function createCollectionHref(sellerId?: string, sellerName?: string) {
  return withFilter("/sellers/collections", {
    ...(sellerId ? { sellerId } : {}),
    ...(sellerName ? { q: sellerName } : {}),
    open: "1",
  });
}

export async function getSellerSummary(sellerId: string, branchId?: string) {
  const [intakeStats, assignmentStats, openPayables, openCollections] = await Promise.all([
    prisma.sellerIntakeItem.aggregate({
      where: {
        sellerIntake: {
          sellerId,
          ...(branchId ? { branchId } : {}),
        },
      },
      _sum: {
        quantityBrought: true,
        quantityAssigned: true,
        quantitySold: true,
        quantityReturned: true,
      },
    }),
    prisma.sellerAssignmentItem.aggregate({
      where: {
        sellerAssignment: {
          sellerId,
          ...(branchId ? { branchId } : {}),
        },
      },
      _sum: {
        quantityAssigned: true,
        quantitySold: true,
        quantityReturned: true,
      },
    }),
    getOpenSellerPayablesBySeller(branchId),
    getOpenSellerCollectionsBySeller(branchId),
  ]);

  const receivedOnHand = 
    (intakeStats._sum.quantityBrought ?? 0) - 
    (intakeStats._sum.quantityAssigned ?? 0) - 
    (intakeStats._sum.quantitySold ?? 0) - 
    (intakeStats._sum.quantityReturned ?? 0);

  const assignedOut = 
    (assignmentStats._sum.quantityAssigned ?? 0) - 
    (assignmentStats._sum.quantitySold ?? 0) - 
    (assignmentStats._sum.quantityReturned ?? 0);

  return {
    receivedOnHand,
    assignedOut,
    payable: openPayables.get(sellerId) ?? 0,
    receivable: openCollections.get(sellerId) ?? 0,
  };
}

export async function getSellerMetrics(branchId?: string) {
  const [payables, collections] = await Promise.all([
    getOpenSellerPayablesBySeller(branchId),
    getOpenSellerCollectionsBySeller(branchId),
  ]);

  const totalPayables = [...payables.values()].reduce((sum, val) => sum + val, 0);
  const totalCollections = [...collections.values()].reduce((sum, val) => sum + val, 0);

  return [
    {
      title: "Total Seller Payables",
      value: formatCurrency(totalPayables),
      tone: "warning" as const,
      meta: "Stock received on consignment",
    },
    {
      title: "Total Seller Receivables",
      value: formatCurrency(totalCollections),
      tone: "success" as const,
      meta: "Assigned stock awaiting collection",
    },
    {
      title: "Active Sellers",
      value: String(payables.size + collections.size),
      meta: "With outstanding balances",
    },
  ];
}

export async function getSellerRows(branchId?: string) {
  const [sellers, intakeStats, assignmentStats, openPayables, openCollections] =
    await Promise.all([
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
        ...(branchId ? { sellerIntake: { branchId } } : {}),
      },
      select: {
        quantityBrought: true,
        quantityAssigned: true,
        quantitySold: true,
        quantityReturned: true,
        sellerIntake: { select: { sellerId: true } },
      },
    }),
    prisma.sellerAssignmentItem.findMany({
      where: {
        ...(branchId ? { sellerAssignment: { branchId } } : {}),
      },
      select: {
        quantityAssigned: true,
        quantitySold: true,
        quantityReturned: true,
        sellerAssignment: { select: { sellerId: true } },
      },
    }),
    getOpenSellerPayablesBySeller(branchId),
    getOpenSellerCollectionsBySeller(branchId),
  ]);

  const intakeItems = intakeStats;
  const assignmentItems = assignmentStats;

  const receivedOnHandMap = new Map<string, number>();
  for (const item of intakeItems) {
    const onHand =
      item.quantityBrought -
      item.quantityAssigned -
      item.quantitySold -
      item.quantityReturned;
    receivedOnHandMap.set(
      item.sellerIntake.sellerId,
      (receivedOnHandMap.get(item.sellerIntake.sellerId) ?? 0) + onHand,
    );
  }

  const assignedOutMap = new Map<string, number>();
  for (const item of assignmentItems) {
    const assignedOut = item.quantityAssigned - item.quantitySold - item.quantityReturned;
    assignedOutMap.set(
      item.sellerAssignment.sellerId,
      (assignedOutMap.get(item.sellerAssignment.sellerId) ?? 0) + assignedOut,
    );
  }

  return sellers.map(
    (seller) => {
      const payableAmount = openPayables.get(seller.id) ?? 0;
      const receivableAmount = openCollections.get(seller.id) ?? 0;

      return ({
        id: seller.id,
        fullName: seller.fullName,
        phone: seller.phone ?? "-",
        location: seller.address ?? "-",
        note: seller.note ?? "-",
        receivedOnHandQty: receivedOnHandMap.get(seller.id) ?? 0,
        assignedOutQty: assignedOutMap.get(seller.id) ?? 0,
        payableAmount,
        receivableAmount,
        lastIntakeAt: seller.intakes[0]?.bringingDate.toISOString() ?? "",
        status: seller.isActive ? "ACTIVE" : "INACTIVE",
        __actions: [
          createRowAction({
            key: "view",
            label: "View",
            href: createSellerOverviewHref(seller.id, branchId),
            icon: "view",
          }),
          createRowAction({
            key: "receive",
            label: "Receive",
            href: createReceiveHref(seller.id, seller.fullName),
            icon: "receive",
            showLabel: true,
          }),
          createRowAction({
            key: "assign",
            label: "Assign",
            href: createAssignHref(undefined, seller.id),
            icon: "assign",
            showLabel: true,
          }),
          createRowAction({
            key: "settle",
            label: "Settle",
            href: withFilter("/sellers/settlements", { sellerId: seller.id, open: "1" }),
            icon: "roles",
            showLabel: true,
          }),
          createRowAction({
            key: "collect",
            label: "Collect",
            href: withFilter("/sellers/collections", { sellerId: seller.id, open: "1" }),
            icon: "collect",
            showLabel: true,
          }),
        ],
      }) satisfies SimpleRow;
    },
  );
}

export async function getSellerIntakeRows(filters: SellerFilters = {}) {
  const bringingDate = getDateRangeFilter(filters);

  const rows = await prisma.sellerIntakeItem.findMany({
    where: {
      ...(bringingDate ? { bringingDate } : {}),
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
              id: true,
              fullName: true,
            },
          },
        },
      },
    },
  });

  return rows.map(
    (row) => {
      const quantityRemaining =
        row.quantityBrought -
        row.quantitySold -
        row.quantityReturned -
        row.quantityAssigned;

      return ({
        id: row.id,
        intakeNumber: row.sellerIntake.intakeNumber,
        seller: row.sellerIntake.seller.fullName,
        branch: row.sellerIntake.branch.name,
        product: row.product.name,
        quantityBrought: row.quantityBrought,
        quantitySold: row.quantitySold,
        quantityReturned: row.quantityReturned,
        quantityRemaining,
        sellerFixedPrice: toNumber(row.sellerFixedPrice),
        bringingDate: row.bringingDate.toISOString(),
        status: quantityRemaining > 0 ? "OPEN" : "CLOSED",
        __actions: [
          createRowAction({
            key: "receive",
            label: "Receive",
            href: createReceiveHref(
              row.sellerIntake.seller.id,
              row.sellerIntake.seller.fullName,
            ),
            icon: "newPurchase",
          }),
          ...(quantityRemaining > 0
            ? [
                createRowAction({
                  key: "return",
                  label: "Return",
                  href: createReturnHref({
                    sellerId: row.sellerIntake.seller.id,
                    sellerName: row.sellerIntake.seller.fullName,
                    intakeItemId: row.id,
                  }),
                  icon: "return",
                }),
              ]
            : []),
          createRowAction({
            key: "pay",
            label: "Pay",
            href: createSettlementHref(
              row.sellerIntake.seller.id,
              row.sellerIntake.seller.fullName,
            ),
            icon: "supplierPayments",
          }),
        ],
      }) satisfies SimpleRow;
    },
  );
}

export async function getSellerAssignCandidateRows(branchId?: string, role: AppRole = "SALES") {
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
            icon: "assign",
          }),
        ],
      }) satisfies SimpleRow,
  );
}

export async function getSellerAssignedRows(filters: SellerFilters = {}, role: AppRole = "SALES") {
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
              id: true,
              fullName: true,
            },
          },
        },
      },
    },
  });

  return rows.map(
    (row) => {
      const remainingQty = row.quantityAssigned - row.quantitySold - row.quantityReturned;

      return ({
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
        remainingQty,
        assignedAt: row.assignmentDate.toISOString(),
        status: remainingQty > 0 ? "ACTIVE" : "CLOSED",
        __actions: [
          createRowAction({
            key: "assign",
            label: "Assign",
            href: createAssignHref(undefined, row.sellerAssignment.seller.id),
            icon: "assign",
          }),
          ...(remainingQty > 0
            ? [
                createRowAction({
                  key: "return",
                  label: "Return",
                  href: createReturnHref({
                    sellerId: row.sellerAssignment.seller.id,
                    sellerName: row.sellerAssignment.seller.fullName,
                    assignmentItemId: row.id,
                  }),
                  icon: "return",
                }),
              ]
            : []),
          createRowAction({
            key: "collect",
            label: "Collect",
            href: createCollectionHref(
              row.sellerAssignment.seller.id,
              row.sellerAssignment.seller.fullName,
            ),
            icon: "collect",
          }),
        ],
      }) satisfies SimpleRow;
    },
  );
}

export async function getSellerReturnRows(filters: SellerFilters & { flow?: string } = {}) {
  const returnDate = getDateRangeFilter(filters);

  const rows = await prisma.sellerReturnItem.findMany({
    where: {
      ...((returnDate || filters.sellerId || filters.branchId)
        ? {
            sellerReturn: {
              ...(returnDate ? { returnDate } : {}),
              ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
              ...(filters.branchId ? { branchId: filters.branchId } : {}),
            },
          }
        : {}),
      ...(filters.flow === "BACK_TO_PARTNER" ? { sellerIntakeItemId: { not: null } } : {}),
      ...(filters.flow === "BACK_TO_BRANCH" ? { sellerAssignmentItemId: { not: null } } : {}),
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
          id: true,
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
          sellerIntake: {
            select: {
              intakeNumber: true,
            },
          },
        },
      },
      sellerAssignmentItem: {
        select: {
          assignmentDate: true,
          sellerAssignment: {
            select: {
              assignmentNumber: true,
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
        returnNumber: row.sellerReturn.returnNumber,
        seller: row.sellerReturn.seller.fullName,
        branch: row.sellerReturn.branch.name,
        product: row.product.name,
        flow: row.sellerIntakeItem ? "BACK_TO_PARTNER" : "BACK_TO_BRANCH",
        sourceRef:
          row.sellerIntakeItem?.sellerIntake.intakeNumber ??
          row.sellerAssignmentItem?.sellerAssignment.assignmentNumber ??
          "-",
        quantity: row.quantity,
        sourceDate: (
          row.sellerIntakeItem?.bringingDate ?? row.sellerAssignmentItem?.assignmentDate
        )?.toISOString() ?? "",
        returnDate: row.sellerReturn.returnDate.toISOString(),
        status: "POSTED",
        __actions: [
          createRowAction({
            key: "view",
            label: "View",
            href: `/sellers/returns/${row.sellerReturn.id}`,
            icon: "view",
          }),
          createRowAction({
            key: "print",
            label: "Print",
            href: `/print/seller-return/${row.sellerReturn.id}`,
            icon: "print",
          }),
        ],
      }) satisfies SimpleRow,
  );
}

export async function getSellerReturnDetail(id: string) {
  return prisma.sellerReturn.findUnique({
    where: { id },
    include: {
      seller: { select: { fullName: true, phone: true } },
      branch: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true, sku: true } },
        },
      },
    },
  });
}

export async function getSellerSettlementRows(filters: SellerFilters = {}) {
  const settlementDate = getDateRangeFilter(filters);

  const rows = await prisma.sellerSettlement.findMany({
    where: {
      ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(settlementDate ? { settlementDate } : {}),
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
          type: true,
          bankName: true,
          accountNumber: true,
        },
      },
      allocations: {
        select: {
          saleItemAllocation: {
            select: {
              saleItem: {
                select: {
                  sale: {
                    select: {
                      saleNumber: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const appliedSales = [
      ...new Set(
        row.allocations.map(
          (allocation) => allocation.saleItemAllocation.saleItem.sale.saleNumber,
        ),
      ),
    ];

    return {
        id: row.id,
        settlementNumber: row.settlementNumber,
        seller: row.seller.fullName,
        branch: row.branch.name,
        paymentMethod: row.paymentMethod,
        account: row.financeAccount ? formatFinanceAccountLabel(row.financeAccount) : "-",
        appliedTo:
          appliedSales.length <= 2
            ? appliedSales.join(", ")
            : `${appliedSales.slice(0, 2).join(", ")} +${appliedSales.length - 2}`,
        amount: toNumber(row.amount),
        settledAt: row.settlementDate.toISOString(),
        status: row.status,
      } satisfies SimpleRow;
  });
}

export async function getSellerCollectionRows(filters: SellerFilters = {}) {
  const collectionDate = getDateRangeFilter(filters);

  const rows = await prisma.sellerCollection.findMany({
    where: {
      ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(collectionDate ? { collectionDate } : {}),
    },
    orderBy: {
      collectionDate: "desc",
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
          type: true,
          bankName: true,
          accountNumber: true,
        },
      },
      allocations: {
        select: {
          saleItemAllocation: {
            select: {
              saleItem: {
                select: {
                  sale: {
                    select: {
                      saleNumber: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const appliedSales = [
      ...new Set(
        row.allocations.map(
          (allocation) => allocation.saleItemAllocation.saleItem.sale.saleNumber,
        ),
      ),
    ];

    return {
      id: row.id,
      collectionNumber: row.collectionNumber,
      seller: row.seller.fullName,
      branch: row.branch.name,
      paymentMethod: row.paymentMethod,
      account: row.financeAccount ? formatFinanceAccountLabel(row.financeAccount) : "-",
      appliedTo:
        appliedSales.length <= 2
          ? appliedSales.join(", ")
          : `${appliedSales.slice(0, 2).join(", ")} +${appliedSales.length - 2}`,
      amount: toNumber(row.amount),
      collectedAt: row.collectionDate.toISOString(),
      status: row.status,
    } satisfies SimpleRow;
  });
}
