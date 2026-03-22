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
  partnerIntakeRows: SimpleRow[];
  partnerPayoutRows: SimpleRow[];
  partnerCollectionRows: SimpleRow[];
  partnerReturnRows: SimpleRow[];
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
        { title: "Partner Items Brought", value: "0" },
        { title: "Partner Received Sales", value: formatCurrency(0) },
        { title: "Expected Partner Payable", value: formatCurrency(0) },
        { title: "Partner Paid Out", value: formatCurrency(0) },
        { title: "Assigned Partner Sales", value: formatCurrency(0) },
        { title: "Expected Partner Collection", value: formatCurrency(0) },
        { title: "Partner Collected", value: formatCurrency(0) },
        { title: "Partner Returns Qty", value: "0" },
        { title: "Today's Expenses", value: formatCurrency(0) },
      ],
      salesRows: [],
      soldItemRows: [],
      partnerIntakeRows: [],
      partnerPayoutRows: [],
      partnerCollectionRows: [],
      partnerReturnRows: [],
    };
  }

  const [
    salesRows,
    soldItemRows,
    partnerIntakeRows,
    partnerPayoutRows,
    partnerCollectionRows,
    partnerReturnRows,
    partnerSaleAllocations,
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

  const postedPartnerPayoutRows = partnerPayoutRows.filter(
    (row) => row.status === "POSTED",
  );
  const postedPartnerCollectionRows = partnerCollectionRows.filter(
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
  const partnerItemsReceived = sumRows(
    partnerIntakeRows.map((row) => toNumber(row.quantityBrought)),
  );
  const partnerReturnQuantity = sumRows(
    partnerReturnRows.map((row) => toNumber(row.quantity)),
  );
  const partnerReceivedSoldAmount = Number(
    partnerSaleAllocations
      .reduce((sum, allocation) => {
        const isPartnerOwned =
          allocation.sourceType === "SELLER_CONSIGNMENT" ||
          (allocation.sourceType === "SELLER_ASSIGNED" &&
            Boolean(allocation.sellerAssignmentItem?.sellerIntakeItemId));

        if (!isPartnerOwned) {
          return sum;
        }

        const lineQuantity = Math.max(allocation.saleItem.quantity, 1);
        const unitRevenue = toNumber(allocation.saleItem.lineTotal) / lineQuantity;

        return sum + unitRevenue * allocation.quantity;
      }, 0)
      .toFixed(2),
  );
  const partnerPayableAmount = Number(
    partnerSaleAllocations
      .reduce((sum, allocation) => {
        const isPartnerOwned =
          allocation.sourceType === "SELLER_CONSIGNMENT" ||
          (allocation.sourceType === "SELLER_ASSIGNED" &&
            Boolean(allocation.sellerAssignmentItem?.sellerIntakeItemId));

        if (!isPartnerOwned) {
          return sum;
        }

        return sum + toNumber(allocation.sellerAmount) * allocation.quantity;
      }, 0)
      .toFixed(2),
  );
  const partnerAssignedSoldAmount = Number(
    partnerSaleAllocations
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
  const partnerCollectionAmount = Number(
    partnerSaleAllocations
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
  const partnerPaidOutAmount = sumRows(
    postedPartnerPayoutRows.map((row) => toNumber(row.amount)),
  );
  const partnerCollectedAmount = sumRows(
    postedPartnerCollectionRows.map((row) => toNumber(row.amount)),
  );
  const expenseTotal = toNumber(expenseAggregate._sum.amount);
  const returnedToPartnerQty = sumRows(
    partnerReturnRows
      .filter((row) => row.flow === "BACK_TO_PARTNER")
      .map((row) => toNumber(row.quantity)),
  );
  const returnedToBranchQty = sumRows(
    partnerReturnRows
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
        title: "Partner Items Brought",
        value: String(partnerItemsReceived),
        meta: `${partnerIntakeRows.length} intake line(s)`,
      },
      {
        title: "Partner Received Sales",
        value: formatCurrency(partnerReceivedSoldAmount),
        meta: "Sold from received partner stock today",
      },
      {
        title: "Expected Partner Payable",
        value: formatCurrency(partnerPayableAmount),
        tone: "warning",
        meta: "Calculated from today's received-partner sales",
      },
      {
        title: "Partner Paid Out",
        value: formatCurrency(partnerPaidOutAmount),
        meta: `${postedPartnerPayoutRows.length} payout(s) posted today`,
      },
      {
        title: "Assigned Partner Sales",
        value: formatCurrency(partnerAssignedSoldAmount),
        meta: "Sold from branch items assigned to partners today",
      },
      {
        title: "Expected Partner Collection",
        value: formatCurrency(partnerCollectionAmount),
        tone: "success",
        meta: "Calculated from today's sold assigned lines",
      },
      {
        title: "Partner Collected",
        value: formatCurrency(partnerCollectedAmount),
        tone: "success",
        meta: `${postedPartnerCollectionRows.length} collection(s) posted today`,
      },
      {
        title: "Partner Returns Qty",
        value: String(partnerReturnQuantity),
        meta: `${returnedToPartnerQty} to partner, ${returnedToBranchQty} back to branch`,
      },
      {
        title: "Today's Expenses",
        value: formatCurrency(expenseTotal),
        tone: expenseTotal > 0 ? "danger" : "default",
      },
    ],
    salesRows,
    soldItemRows,
    partnerIntakeRows,
    partnerPayoutRows: postedPartnerPayoutRows,
    partnerCollectionRows: postedPartnerCollectionRows,
    partnerReturnRows,
  };
}
