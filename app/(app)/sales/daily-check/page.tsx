import { PageHeader } from "@/components/app-shell/page-header";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { DailyCheckTableCard } from "@/components/sales/daily-check-table-card";
import { getCurrentUser } from "@/lib/auth/session";
import { getDailyCheckSnapshot } from "@/lib/daily-check-data";
import type { SimpleColumn } from "@/lib/table";

const salesColumns: SimpleColumn[] = [
  { key: "saleNumber", header: "Sale No." },
  { key: "customer", header: "Customer" },
  { key: "paymentMethod", header: "Payment", type: "status" },
  { key: "total", header: "Total", type: "currency" },
  { key: "amountDue", header: "Amount Due", type: "currency" },
  { key: "soldAt", header: "Sold At", type: "dateTime" },
];

const soldItemsColumns: SimpleColumn[] = [
  { key: "product", header: "Item" },
  { key: "quantity", header: "Qty", type: "number" },
  { key: "source", header: "Source", type: "status" },
  { key: "seller", header: "Partner" },
  { key: "total", header: "Total", type: "currency" },
  { key: "soldAt", header: "Sold At", type: "dateTime" },
];

const intakeColumns: SimpleColumn[] = [
  { key: "intakeNumber", header: "Record No." },
  { key: "seller", header: "Partner" },
  { key: "product", header: "Item" },
  { key: "quantityBrought", header: "Brought", type: "number" },
  { key: "quantitySold", header: "Sold", type: "number" },
  { key: "quantityReturned", header: "Returned", type: "number" },
  { key: "quantityRemaining", header: "Remaining", type: "number" },
  { key: "sellerFixedPrice", header: "Partner Price", type: "currency" },
  { key: "bringingDate", header: "Received At", type: "dateTime" },
];

const payoutColumns: SimpleColumn[] = [
  { key: "settlementNumber", header: "Settlement No." },
  { key: "seller", header: "Partner" },
  { key: "paymentMethod", header: "Method", type: "status" },
  { key: "account", header: "Account" },
  { key: "appliedTo", header: "Applied To" },
  { key: "amount", header: "Amount", type: "currency" },
  { key: "settledAt", header: "Paid At", type: "dateTime" },
];

const collectionColumns: SimpleColumn[] = [
  { key: "collectionNumber", header: "Collection No." },
  { key: "seller", header: "Partner" },
  { key: "paymentMethod", header: "Method", type: "status" },
  { key: "account", header: "Account" },
  { key: "appliedTo", header: "Applied To" },
  { key: "amount", header: "Amount", type: "currency" },
  { key: "collectedAt", header: "Collected At", type: "dateTime" },
];

const returnColumns: SimpleColumn[] = [
  { key: "returnNumber", header: "Return No." },
  { key: "seller", header: "Partner" },
  { key: "product", header: "Item" },
  { key: "flow", header: "Flow", type: "status" },
  { key: "quantity", header: "Returned", type: "number" },
  { key: "sourceDate", header: "Source Date", type: "dateTime" },
  { key: "returnDate", header: "Returned At", type: "dateTime" },
];

export default async function Page() {
  const user = await getCurrentUser();
  const activeBranch =
    user?.branches.find((branch) => branch.id === user.activeBranchId) ?? user?.branches[0];
  const snapshot = await getDailyCheckSnapshot(
    activeBranch?.id ? { branchId: activeBranch.id } : {},
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Check"
        description={`Cross-check ${snapshot.dateLabel} activity for ${activeBranch?.code ?? "the active branch"}${activeBranch?.name ? ` - ${activeBranch.name}` : ""}.`}
      />
      <MetricGrid metrics={snapshot.metrics} />
      <div className="grid gap-6 xl:grid-cols-2">
        <DailyCheckTableCard
          title="Today's Sales"
          description="Completed sales for the active branch today."
          columns={salesColumns}
          rows={snapshot.salesRows}
          exportFileName="daily-check-sales"
        />
        <DailyCheckTableCard
          title="Today's Sold Items"
          description="Item-level sales lines for today's cross-check."
          columns={soldItemsColumns}
          rows={snapshot.soldItemRows}
          exportFileName="daily-check-sold-items"
        />
        <DailyCheckTableCard
          title="Today's Partner Intakes"
          description="Items partners brought today, with sold, returned, and remaining quantities."
          columns={intakeColumns}
          rows={snapshot.partnerIntakeRows}
          exportFileName="daily-check-partner-intakes"
        />
        <DailyCheckTableCard
          title="Today's Partner Payouts"
          description="Birr paid out today for sold received-partner items."
          columns={payoutColumns}
          rows={snapshot.partnerPayoutRows}
          exportFileName="daily-check-partner-payouts"
        />
        <DailyCheckTableCard
          title="Today's Partner Collections"
          description="Birr collected today for sold assigned items."
          columns={collectionColumns}
          rows={snapshot.partnerCollectionRows}
          exportFileName="daily-check-partner-collections"
        />
        <DailyCheckTableCard
          title="Today's Partner Returns"
          description="Unsold items returned either back to the partner or back into branch stock today."
          columns={returnColumns}
          rows={snapshot.partnerReturnRows}
          exportFileName="daily-check-partner-returns"
        />
      </div>
    </div>
  );
}
