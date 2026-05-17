import { endOfDay, format, startOfDay } from "date-fns";
import { unstable_noStore as noStore } from "next/cache";

import { prisma } from "@/lib/prisma";
import type { SimpleRow } from "@/lib/table";
import type { MetricCard } from "@/lib/types";
import { getSalesRows, getSoldItemRows } from "@/lib/page-data-sales";
import {
  getSellerCollectionRows,
  getSellerIntakeRows,
  getSellerReturnRows,
  getSellerSettlementRows,
} from "@/lib/page-data-sellers";
import { sumRows, toNumber } from "@/lib/data-runtime-utils";
import { formatCurrency } from "@/lib/utils";

export type DailyCheckSnapshot = {
  dateLabel: string;
  metrics: MetricCard[];
  salesRows: SimpleRow[];
  soldItemRows: SimpleRow[];
  sellerIntakeRows: SimpleRow[];
  sellerPayoutRows: SimpleRow[];
  sellerCollectionRows: SimpleRow[];
  sellerReturnRows: SimpleRow[];
};

export async function getDailyCheckSnapshot(args: {
  branchId?: string;
}): Promise<DailyCheckSnapshot> {
  noStore();

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const todayKey = format(todayStart, "yyyy-MM-dd");
  const dateLabel = format(todayStart, "dd MMM yyyy");

  if (!args.branchId) {
    return {
      dateLabel,
      metrics: [
        { title: "Today's Total Sales", value: formatCurrency(0), meta: "Daily total" },
        { title: "Today's Cash Sales", value: formatCurrency(0), meta: "Daily total" },
        { title: "Today's Bank Sales", value: formatCurrency(0), meta: "Daily total" },
        { title: "Today's Credit Sales", value: formatCurrency(0), meta: "Daily total" },
        { title: "Seller Items Brought", value: "0" },
        { title: "Seller Received Sales", value: formatCurrency(0) },
        { title: "Expected Seller Payable", value: formatCurrency(0) },
        { title: "Seller Paid Out", value: formatCurrency(0) },
        { title: "Assigned Seller Sales", value: formatCurrency(0) },
        { title: "Expected Seller Collection", value: formatCurrency(0) },
        { title: "Seller Collected", value: formatCurrency(0) },
        { title: "Seller Returns Qty", value: "0" },
        { title: "Today's Expenses", value: formatCurrency(0) },
      ],
      salesRows: [],
      soldItemRows: [],
      sellerIntakeRows: [],
      sellerPayoutRows: [],
      sellerCollectionRows: [],
      sellerReturnRows: [],
    };
  }

  const [
    salesRows,
    soldItemRows,
    sellerIntakeRows,
    sellerPayoutRows,
    sellerCollectionRows,
    sellerReturnRows,
    sellerSaleAllocations,
    expenseAggregate,
  ] = await Promise.all([
    getSalesRows({
      branchId: args.branchId,
      dateFrom: todayKey,
      dateTo: todayKey,
    }),
    getSoldItemRows({
      branchId: args.branchId,
      dateFrom: todayKey,
      dateTo: todayKey,
    }),
    getSellerIntakeRows({
      branchId: args.branchId,
      dateFrom: todayKey,
      dateTo: todayKey,
    }),
    getSellerSettlementRows({
      branchId: args.branchId,
      dateFrom: todayKey,
      dateTo: todayKey,
    }),
    getSellerCollectionRows({
      branchId: args.branchId,
      dateFrom: todayKey,
      dateTo: todayKey,
    }),
    getSellerReturnRows({
      branchId: args.branchId,
      dateFrom: todayKey,
      dateTo: todayKey,
    }),
    prisma.saleItemAllocation.findMany({
      where: {
        sourceType: {
          in: ["SELLER_CONSIGNMENT", "SELLER_ASSIGNED"],
        },
        saleItem: {
          sale: {
            branchId: args.branchId,
            status: "COMPLETED",
            soldAt: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
        },
      },
      select: {
        quantity: true,
        sellerAmount: true,
        sourceType: true,
        unitCost: true,
        sellerAssignmentItem: {
          select: {
            sellerIntakeItemId: true,
          },
        },
        saleItem: {
          select: {
            quantity: true,
            lineTotal: true,
          },
        },
      },
    }),
    prisma.expense.aggregate({
      where: {
        branchId: args.branchId,
        status: "POSTED",
        expenseDate: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  const postedSellerPayoutRows = sellerPayoutRows.filter(
    (row) => row.status === "POSTED",
  );
  const postedSellerCollectionRows = sellerCollectionRows.filter(
    (row) => row.status === "POSTED",
  );

  const totalSales = sumRows(salesRows.map((row) => toNumber(row.total)));
  const cashSales = sumRows(
    salesRows
      .filter((row) => row.paymentMethod === "CASH")
      .map((row) => toNumber(row.total)),
  );
  const bankSales = sumRows(
    salesRows
      .filter((row) => row.paymentMethod === "BANK")
      .map((row) => toNumber(row.total)),
  );
  const creditSales = sumRows(
    salesRows
      .filter((row) => row.paymentMethod === "CREDIT")
      .map((row) => toNumber(row.total)),
  );

  const sellerItemsReceived = sumRows(
    sellerIntakeRows.map((row) => toNumber(row.quantityBrought)),
  );
  const sellerReturnQuantity = sumRows(
    sellerReturnRows.map((row) => toNumber(row.quantity)),
  );

  const sellerReceivedSoldAmount = Number(
    sellerSaleAllocations
      .reduce((sum, allocation) => {
        const isSellerOwned =
          allocation.sourceType === "SELLER_CONSIGNMENT" ||
          (allocation.sourceType === "SELLER_ASSIGNED" &&
            Boolean(allocation.sellerAssignmentItem?.sellerIntakeItemId));

        if (!isSellerOwned) {
          return sum;
        }

        const lineQuantity = Math.max(allocation.saleItem.quantity, 1);
        const unitRevenue = toNumber(allocation.saleItem.lineTotal) / lineQuantity;

        return sum + unitRevenue * allocation.quantity;
      }, 0)
      .toFixed(2),
  );

  const sellerPayableAmount = Number(
    sellerSaleAllocations
      .reduce((sum, allocation) => {
        const isSellerOwned =
          allocation.sourceType === "SELLER_CONSIGNMENT" ||
          (allocation.sourceType === "SELLER_ASSIGNED" &&
            Boolean(allocation.sellerAssignmentItem?.sellerIntakeItemId));

        if (!isSellerOwned) {
          return sum;
        }

        return sum + toNumber(allocation.sellerAmount) * allocation.quantity;
      }, 0)
      .toFixed(2),
  );

  const sellerAssignedSoldAmount = Number(
    sellerSaleAllocations
      .reduce((sum, allocation) => {
        const isAssignedFromUs =
          allocation.sourceType === "SELLER_ASSIGNED" &&
          !allocation.sellerAssignmentItem?.sellerIntakeItemId;

        if (!isAssignedFromUs) {
          return sum;
        }

        const lineQuantity = Math.max(allocation.saleItem.quantity, 1);
        const unitRevenue = toNumber(allocation.saleItem.lineTotal) / lineQuantity;

        return sum + unitRevenue * allocation.quantity;
      }, 0)
      .toFixed(2),
  );

  const sellerCollectionAmount = Number(
    sellerSaleAllocations
      .reduce((sum, allocation) => {
        const isAssignedFromUs =
          allocation.sourceType === "SELLER_ASSIGNED" &&
          !allocation.sellerAssignmentItem?.sellerIntakeItemId;

        if (!isAssignedFromUs) {
          return sum;
        }

        return sum + toNumber(allocation.sellerAmount) * allocation.quantity;
      }, 0)
      .toFixed(2),
  );

  const sellerPayoutTotal = sumRows(
    postedSellerPayoutRows.map((row) => toNumber(row.amount)),
  );
  const sellerCollectionTotal = sumRows(
    postedSellerCollectionRows.map((row) => toNumber(row.amount)),
  );

  const expenseTotal = toNumber(expenseAggregate._sum.amount);
  const returnedToSellerQty = sumRows(
    sellerReturnRows
      .filter((row) => row.flow === "BACK_TO_PARTNER")
      .map((row) => toNumber(row.quantity)),
  );
  const returnedToBranchQty = sumRows(
    sellerReturnRows
      .filter((row) => row.flow === "BACK_TO_BRANCH")
      .map((row) => toNumber(row.quantity)),
  );

  return {
    dateLabel,
    metrics: [
      {
        title: "Today's Total Sales",
        value: formatCurrency(totalSales),
        meta: `${salesRows.length} receipt(s)`,
      },
      {
        title: "Today's Cash Sales",
        value: formatCurrency(cashSales),
        tone: "success",
        meta: "Daily total",
      },
      {
        title: "Today's Bank Sales",
        value: formatCurrency(bankSales),
        meta: "Daily total",
      },
      {
        title: "Today's Credit Sales",
        value: formatCurrency(creditSales),
        tone: "warning",
        meta: "Daily total",
      },
      {
        title: "Seller Items Brought",
        value: String(sellerItemsReceived),
        meta: `${sellerIntakeRows.length} intake line(s)`,
      },
      {
        title: "Seller Received Sales",
        value: formatCurrency(sellerReceivedSoldAmount),
        meta: "Sold from received seller stock today",
      },
      {
        title: "Expected Seller Payable",
        value: formatCurrency(sellerPayableAmount),
        tone: "warning",
        meta: "Calculated from today's received-seller sales",
      },
      {
        title: "Seller Paid Out",
        value: formatCurrency(sellerPayoutTotal),
        meta: `${postedSellerPayoutRows.length} payout(s) posted today`,
      },
      {
        title: "Assigned Seller Sales",
        value: formatCurrency(sellerAssignedSoldAmount),
        meta: "Sold from branch items assigned to sellers today",
      },
      {
        title: "Expected Seller Collection",
        value: formatCurrency(sellerCollectionAmount),
        tone: "success",
        meta: "Calculated from today's sold assigned lines",
      },
      {
        title: "Seller Collected",
        value: formatCurrency(sellerCollectionTotal),
        tone: "success",
        meta: `${postedSellerCollectionRows.length} collection(s) posted today`,
      },
      {
        title: "Seller Returns Qty",
        value: `${returnedToSellerQty + returnedToBranchQty} units`,
        meta: `${returnedToSellerQty} to seller, ${returnedToBranchQty} back to branch`,
      },
      {
        title: "Today's Expenses",
        value: formatCurrency(expenseTotal),
        tone: expenseTotal > 0 ? "danger" : "default",
      },
    ],
    salesRows,
    soldItemRows,
    sellerIntakeRows,
    sellerPayoutRows: postedSellerPayoutRows,
    sellerCollectionRows: postedSellerCollectionRows,
    sellerReturnRows,
  };
}
