import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { hasPermission } from "@/lib/rbac";
export default async function DashboardPage() {
    const currentUser = await getCurrentUser();
    const role = currentUser?.role ?? "SALES";
    const dashboardSnapshot = await getDashboardSnapshot(role);
    const canViewReports = hasPermission(role, "reports:view");
    const showSalesTrend = canViewReports;
    return (_jsxs("div", { className: "min-w-0 space-y-6", children: [_jsx(PageHeader, { eyebrow: "Dashboard", title: "Operations Overview", description: role === "ADMIN"
                    ? "Branch-aware stock, sales, credit, and finance snapshots for today's trading activity."
                    : "Today's sales, customer credit, and stock alerts for the active branch." }), _jsx(MetricGrid, { metrics: dashboardSnapshot.metrics, mobileColumns: 2 }), _jsxs("div", { className: `grid min-w-0 gap-6${canViewReports ? " xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" : ""}`, children: [_jsx("div", { className: "min-w-0", children: _jsx(QuickActionsCard, { role: role }) }), canViewReports ? (_jsx("div", { className: "min-w-0", children: _jsx(ReportShowcaseCard, {}) })) : null] }), showSalesTrend ? (_jsxs("div", { className: "grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]", children: [_jsx("div", { className: "min-w-0", children: _jsx(SalesTrendChart, { data: dashboardSnapshot.salesTrend }) }), _jsx("div", { className: "min-w-0", children: _jsx(RecentTransactionsCard, { transactions: dashboardSnapshot.recentTransactions }) })] })) : (_jsx("div", { className: "min-w-0", children: _jsx(RecentTransactionsCard, { transactions: dashboardSnapshot.recentTransactions }) })), _jsxs("div", { className: "grid min-w-0 gap-6 xl:grid-cols-2", children: [_jsx("div", { className: "min-w-0", children: _jsx(TopProductsCard, { products: dashboardSnapshot.topProducts }) }), _jsx("div", { className: "min-w-0", children: _jsx(LowStockCard, { rows: dashboardSnapshot.lowStock }) })] })] }));
}
