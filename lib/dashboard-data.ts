import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { unstable_noStore as noStore } from "next/cache";

import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/lib/rbac";
import type { SimpleRow } from "@/lib/table";
import type {
  MetricCard,
  RecentTransaction,
  TopProductCardItem,
  TrendPoint,
} from "@/lib/types";
import { sumRows, toNumber } from "@/lib/data-runtime-utils";
import { formatCurrency } from "@/lib/utils";
import {
  getOpenSellerCollectionsBySeller,
  getOpenSellerPayablesBySeller,
  getStockSummaryRows,
} from "@/lib/stock-runtime-data";

export type DashboardSnapshot = {
  metrics: MetricCard[];
  salesTrend: TrendPoint[];
  recentTransactions: RecentTransaction[];
  lowStock: SimpleRow[];
  topProducts: TopProductCardItem[];
};

async function getLowStockRows(branchId?: string) {
  const stockSummary = await getStockSummaryRows(branchId);

  return stockSummary
    .filter(
      (row) => row.minimumStockAlert > 0 && row.totalQty <= row.minimumStockAlert,
    )
    .map(
      (row) =>
        ({
          id: row.id,
          branch: row.branch,
          name: row.product,
          currentStock: row.totalQty,
          minimumStockAlert: row.minimumStockAlert,
          status:
            row.totalQty <= Math.max(1, Math.floor(row.minimumStockAlert / 2))
              ? "CRITICAL"
              : "LOW",
        }) satisfies SimpleRow,
    );
}

export async function getDashboardSnapshot(
  role: AppRole,
  branchId?: string,
): Promise<DashboardSnapshot> {
  noStore();

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const lastSevenStart = startOfDay(subDays(new Date(), 6));

  const [
    todaySales,
    todaySaleItems,
    stockSummary,
    lowStock,
    receivableAggregate,
    supplierAggregate,
    sellerPayables,
    sellerCollections,
    recentSales,
    recentPurchases,
    recentExpenses,
    recentSettlements,
    recentCollections,
    sevenDaySales,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: {
        status: "COMPLETED",
        ...(branchId ? { branchId } : {}),
        soldAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      select: {
        total: true,
        paymentMethod: true,
      },
    }),
    prisma.saleItem.findMany({
      where: {
        sale: {
          status: "COMPLETED",
          ...(branchId ? { branchId } : {}),
          soldAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      },
      select: {
        lineTotal: true,
        allocations: {
          select: {
            quantity: true,
            sourceType: true,
            unitCost: true,
            sellerAmount: true,
            sellerAssignmentItem: {
              select: {
                sellerIntakeItemId: true,
              },
            },
          },
        },
      },
    }),
    getStockSummaryRows(branchId),
    getLowStockRows(branchId),
    prisma.sale.aggregate({
      where: {
        status: "COMPLETED",
        ...(branchId ? { branchId } : {}),
      },
      _sum: {
        amountDue: true,
      },
    }),
    prisma.purchase.aggregate({
      where: {
        status: "POSTED",
        ...(branchId ? { branchId } : {}),
      },
      _sum: {
        amountDue: true,
      },
    }),
    getOpenSellerPayablesBySeller(branchId),
    getOpenSellerCollectionsBySeller(branchId),
    prisma.sale.findMany({
      where: {
        status: "COMPLETED",
        ...(branchId ? { branchId } : {}),
      },
      orderBy: {
        soldAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        saleNumber: true,
        total: true,
        soldAt: true,
        branch: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.purchase.findMany({
      where: {
        status: "POSTED",
        ...(branchId ? { branchId } : {}),
      },
      orderBy: {
        purchasedAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        purchaseNumber: true,
        total: true,
        purchasedAt: true,
        branch: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.expense.findMany({
      where: {
        status: "POSTED",
        ...(branchId ? { branchId } : {}),
      },
      orderBy: {
        expenseDate: "desc",
      },
      take: 5,
      select: {
        id: true,
        expenseNumber: true,
        amount: true,
        expenseDate: true,
        branch: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.sellerSettlement.findMany({
      where: {
        status: "POSTED",
        ...(branchId ? { branchId } : {}),
      },
      orderBy: {
        settlementDate: "desc",
      },
      take: 5,
      select: {
        id: true,
        settlementNumber: true,
        amount: true,
        settlementDate: true,
        branch: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.sellerCollection.findMany({
      where: {
        status: "POSTED",
        ...(branchId ? { branchId } : {}),
      },
      orderBy: {
        collectionDate: "desc",
      },
      take: 5,
      select: {
        id: true,
        collectionNumber: true,
        amount: true,
        collectionDate: true,
        branch: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.sale.findMany({
      where: {
        status: "COMPLETED",
        ...(branchId ? { branchId } : {}),
        soldAt: {
          gte: lastSevenStart,
          lte: todayEnd,
        },
      },
      select: {
        soldAt: true,
        total: true,
      },
    }),
  ]);

  const todaySalesTotal = sumRows(todaySales.map((sale) => toNumber(sale.total)));
  const todayCashSales = sumRows(
    todaySales
      .filter((sale) => sale.paymentMethod === "CASH")
      .map((sale) => toNumber(sale.total)),
  );
  const todayProfit = Number(
    todaySaleItems
      .reduce((sum, saleItem) => {
        const saleTotal = toNumber(saleItem.lineTotal);
        const costTotal = saleItem.allocations.reduce((costSum, allocation) => {
          const isPartnerOwned =
            allocation.sourceType === "SELLER_CONSIGNMENT" ||
            (allocation.sourceType === "SELLER_ASSIGNED" &&
              Boolean(allocation.sellerAssignmentItem?.sellerIntakeItemId));

          if (!isPartnerOwned) {
            return costSum + toNumber(allocation.unitCost) * allocation.quantity;
          }

          return costSum + toNumber(allocation.sellerAmount) * allocation.quantity;
        }, 0);

        return sum + (saleTotal - costTotal);
      }, 0)
      .toFixed(2),
  );
  const todayBankSales = sumRows(
    todaySales
      .filter((sale) => sale.paymentMethod === "BANK")
      .map((sale) => toNumber(sale.total)),
  );
  const todayCreditSales = sumRows(
    todaySales
      .filter((sale) => sale.paymentMethod === "CREDIT")
      .map((sale) => toNumber(sale.total)),
  );
  const totalStockValue = sumRows(stockSummary.map((row) => row.stockValue));
  const sellerPayableTotal = sumRows([...sellerPayables.values()]);
  const sellerCollectionTotal = sumRows([...sellerCollections.values()]);

  const trendMap = new Map<string, number>();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = subDays(new Date(), offset);
    trendMap.set(format(day, "yyyy-MM-dd"), 0);
  }

  for (const sale of sevenDaySales) {
    const key = format(sale.soldAt, "yyyy-MM-dd");
    trendMap.set(key, (trendMap.get(key) ?? 0) + toNumber(sale.total));
  }

  const salesTrend = [...trendMap.entries()].map(([day, value]) => ({
    label: format(new Date(day), "EEE"),
    value,
  }));

  const recentTransactions = [
    ...recentSales.map(
      (sale) =>
        ({
          id: sale.id,
          type: "Sale",
          reference: sale.saleNumber,
          amount: toNumber(sale.total),
          branch: sale.branch.name,
          createdAt: sale.soldAt.toISOString(),
        }) satisfies RecentTransaction,
    ),
    ...recentPurchases.map(
      (purchase) =>
        ({
          id: purchase.id,
          type: "Purchase",
          reference: purchase.purchaseNumber,
          amount: toNumber(purchase.total),
          branch: purchase.branch.name,
          createdAt: purchase.purchasedAt.toISOString(),
        }) satisfies RecentTransaction,
    ),
    ...recentExpenses.map(
      (expense) =>
        ({
          id: expense.id,
          type: "Expense",
          reference: expense.expenseNumber,
          amount: toNumber(expense.amount),
          branch: expense.branch.name,
          createdAt: expense.expenseDate.toISOString(),
        }) satisfies RecentTransaction,
    ),
    ...recentSettlements.map(
      (settlement) =>
        ({
          id: settlement.id,
          type: "Settlement",
          reference: settlement.settlementNumber,
          amount: toNumber(settlement.amount),
          branch: settlement.branch.name,
          createdAt: settlement.settlementDate.toISOString(),
        }) satisfies RecentTransaction,
    ),
    ...recentCollections.map(
      (collection) =>
        ({
          id: collection.id,
          type: "Collection",
          reference: collection.collectionNumber,
          amount: toNumber(collection.amount),
          branch: collection.branch.name,
          createdAt: collection.collectionDate.toISOString(),
        }) satisfies RecentTransaction,
    ),
  ]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .slice(0, 6);

  const productStockMap = new Map<string, TopProductCardItem>();
  for (const row of stockSummary) {
    const existing = productStockMap.get(row.productId) ?? {
      id: row.productId,
      name: row.product,
      currentStock: 0,
      value: 0,
    };

    existing.currentStock += row.totalQty;
    existing.value += Math.max(row.stockValue, 0);
    productStockMap.set(row.productId, existing);
  }

  const topProducts = [...productStockMap.values()]
    .filter((product) => product.currentStock > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 4);

  const metrics: MetricCard[] = [
    {
      title: "Today's Total Sales",
      value: formatCurrency(todaySalesTotal),
      meta: "Daily total",
    },
    {
      title: "Today's Cash Sales",
      value: formatCurrency(todayCashSales),
      tone: "success",
      meta: "Daily total",
    },
    {
      title: "Today's Bank Sales",
      value: formatCurrency(todayBankSales),
      meta: "Daily total",
    },
    {
      title: "Today's Credit Sales",
      value: formatCurrency(todayCreditSales),
      tone: "warning",
      meta: "Daily total",
    },
    {
      title: "Low Stock Count",
      value: String(lowStock.length),
      tone: lowStock.length > 0 ? "danger" : "default",
    },
    {
      title: "Customer Receivables",
      value: formatCurrency(toNumber(receivableAggregate._sum.amountDue)),
      tone: "warning",
    },
  ];

  if (role === "ADMIN") {
    metrics.splice(2, 0, {
      title: "Today's Profit",
      value: formatCurrency(todayProfit),
      tone: todayProfit > 0 ? "success" : "default",
      meta: "Gross profit in birr",
    });

    metrics.push(
      {
        title: "Total Stock Value",
        value: formatCurrency(Math.max(totalStockValue, 0)),
      },
      {
        title: "Supplier Payables",
        value: formatCurrency(toNumber(supplierAggregate._sum.amountDue)),
        tone: "danger",
      },
      {
        title: "Seller Payables",
        value: formatCurrency(sellerPayableTotal),
        tone: "warning",
      },
      {
        title: "Seller Receivables",
        value: formatCurrency(sellerCollectionTotal),
        tone: "success",
      },
    );
  }

  return {
    metrics,
    salesTrend,
    recentTransactions:
      role === "ADMIN"
        ? recentTransactions
        : recentTransactions.filter((transaction) => transaction.type === "Sale"),
    lowStock,
    topProducts,
  };
}
