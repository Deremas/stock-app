import { LowStockCard } from "@/components/dashboard/low-stock-card";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { RecentTransactionsCard } from "@/components/dashboard/recent-transactions-card";
import { ReportShowcaseCard } from "@/components/dashboard/report-showcase-card";
import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";
import { SalesTrendChart } from "@/components/dashboard/sales-trend-chart";
import { TopProductsCard } from "@/components/dashboard/top-products-card";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardSnapshot } from "@/lib/page-data";

export default async function DashboardPage() {
  const [dashboardSnapshot, currentUser] = await Promise.all([
    getDashboardSnapshot(),
    getCurrentUser(),
  ]);

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Operations Overview"
        description="Branch-aware stock, sales, credit, and finance snapshots for today's trading activity."
      />
      <MetricGrid metrics={dashboardSnapshot.metrics} />
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="min-w-0">
          <QuickActionsCard role={currentUser?.role ?? "SALES"} />
        </div>
        <div className="min-w-0">
          <ReportShowcaseCard />
        </div>
      </div>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <SalesTrendChart data={dashboardSnapshot.salesTrend} />
        </div>
        <div className="min-w-0">
          <RecentTransactionsCard transactions={dashboardSnapshot.recentTransactions} />
        </div>
      </div>
      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <div className="min-w-0">
          <TopProductsCard products={dashboardSnapshot.topProducts} />
        </div>
        <div className="min-w-0">
          <LowStockCard rows={dashboardSnapshot.lowStock} />
        </div>
      </div>
    </div>
  );
}
