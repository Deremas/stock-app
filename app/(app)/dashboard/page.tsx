import { LowStockCard } from "@/components/dashboard/low-stock-card";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { RecentTransactionsCard } from "@/components/dashboard/recent-transactions-card";
import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";
import { SalesTrendChart } from "@/components/dashboard/sales-trend-chart";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardSnapshot } from "@/lib/page-data";
import { hasPermission } from "@/lib/rbac";

const adminMetricTitles = new Set([
  "Today's Total Sales",
  "Today's Profit",
  "Today's Cash Sales",
  "Today's Credit Sales",
  "Low Stock Count",
  "Customer Receivables",
]);

const salesMetricTitles = new Set([
  "Today's Total Sales",
  "Today's Cash Sales",
  "Today's Credit Sales",
  "Low Stock Count",
]);

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();
  const role = currentUser?.role ?? "SALES";
  const dashboardSnapshot = await getDashboardSnapshot(role, currentUser?.activeBranchId);
  const canViewReports = hasPermission(role, "reports:view");
  const visibleMetricTitles = role === "ADMIN" ? adminMetricTitles : salesMetricTitles;
  const visibleMetrics = dashboardSnapshot.metrics.filter((metric) =>
    visibleMetricTitles.has(metric.title),
  );

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        eyebrow="Dashboard"
        title={role === "ADMIN" ? "Shop Overview" : "Sales Overview"}
        description={
          role === "ADMIN"
            ? "Today at Metebaber: sales, profit, credit, and stock requiring attention."
            : "Your essential sales totals and stock alerts for today."
        }
      />
      <MetricGrid metrics={visibleMetrics} mobileColumns={2} />
      <QuickActionsCard role={role} />
      <div
        className={
          canViewReports
            ? "grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.85fr)]"
            : "min-w-0"
        }
      >
        {canViewReports ? (
          <div className="min-w-0">
            <SalesTrendChart data={dashboardSnapshot.salesTrend} />
          </div>
        ) : null}
        <div className="min-w-0">
          <RecentTransactionsCard transactions={dashboardSnapshot.recentTransactions} />
        </div>
      </div>
      <div className="min-w-0">
        <div className="min-w-0">
          <LowStockCard rows={dashboardSnapshot.lowStock} />
        </div>
      </div>
    </div>
  );
}
