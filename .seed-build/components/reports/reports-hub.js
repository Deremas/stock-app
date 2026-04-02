"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
const reportOptions = [
    {
        id: "daily-check",
        name: "Daily Check",
        description: "Daily sales, partner, payout, collection, and return snapshot.",
        href: "/sales/daily-check",
    },
    {
        id: "sales-profit",
        name: "Sales Profit",
        description: "Daily sales with cost, partner payable, and gross profit.",
        href: "/reports/sales",
    },
    {
        id: "partner-exposure",
        name: "Partner Exposure",
        description: "Open received stock, assigned-out stock, unpaid payables, and uncollected receivables.",
        href: "/reports/sellers",
    },
    {
        id: "expense-summary",
        name: "Expense Summary",
        description: "Expense totals by category for daily, weekly, and monthly review.",
        href: "/reports/finance",
    },
    {
        id: "stock-overview",
        name: "Current Stock",
        description: "Current stock by item and branch.",
        href: "/inventory/stock-overview",
    },
    {
        id: "low-stock",
        name: "Low Stock",
        description: "Items that need replenishment soon.",
        href: "/inventory/low-stock",
    },
    {
        id: "sold-items",
        name: "Sold Items",
        description: "Line-level sales history for items sold.",
        href: "/sales/sold-items",
    },
    {
        id: "customer-credit",
        name: "Customer Credit",
        description: "Outstanding customer balances and aging.",
        href: "/sales/customer-credit",
    },
    {
        id: "purchase-list",
        name: "Purchase List",
        description: "Supplier purchases with totals and balances.",
        href: "/purchases/list",
    },
    {
        id: "seller-settlements",
        name: "Partner Payments",
        description: "Partner payout history with exact received-stock lines paid.",
        href: "/sellers/settlements",
    },
    {
        id: "seller-collections",
        name: "Partner Collections",
        description: "Cash and bank collections posted for sold assigned items.",
        href: "/sellers/collections",
    },
    {
        id: "seller-returns",
        name: "Partner Returns",
        description: "Unsold items returned either back to the partner or into branch stock.",
        href: "/sellers/returns",
    },
    {
        id: "seller-intakes",
        name: "Partner Received Records",
        description: "Received partner stock with sold, returned, and remaining quantities.",
        href: "/sellers/intake-records",
    },
];
export function ReportsHub({ branches }) {
    const router = useRouter();
    const [reportHref, setReportHref] = useState(reportOptions[0]?.href ?? "/reports");
    const [branchId, setBranchId] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [keyword, setKeyword] = useState("");
    const activeReport = useMemo(() => reportOptions.find((option) => option.href === reportHref) ?? reportOptions[0], [reportHref]);
    function openReport(targetHref) {
        const url = new URL(targetHref, window.location.origin);
        if (branchId) {
            url.searchParams.set("branchId", branchId);
        }
        if (dateFrom) {
            url.searchParams.set("dateFrom", dateFrom);
        }
        if (dateTo) {
            url.searchParams.set("dateTo", dateTo);
        }
        if (keyword.trim()) {
            url.searchParams.set("q", keyword.trim());
        }
        router.push(`${url.pathname}${url.search}`);
    }
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Open a report" }), _jsx(CardDescription, { children: "Choose the report you want, apply the basic filters, then open it." })] }), _jsxs(CardContent, { className: "space-y-5", children: [_jsxs("div", { className: "grid gap-4 lg:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "reportHref", children: "Report" }), _jsx(Select, { id: "reportHref", value: reportHref, onChange: (event) => setReportHref(event.target.value), children: reportOptions.map((option) => (_jsx("option", { value: option.href, children: option.name }, option.href))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "branchId", children: "Branch" }), _jsxs(Select, { id: "branchId", value: branchId, onChange: (event) => setBranchId(event.target.value), children: [_jsx("option", { value: "", children: "All branches" }), branches.map((branch) => (_jsxs("option", { value: branch.id, children: [branch.code, " - ", branch.name] }, branch.id)))] })] })] }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-3", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "dateFrom", children: "Date from" }), _jsx(Input, { id: "dateFrom", type: "date", value: dateFrom, onChange: (event) => setDateFrom(event.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "dateTo", children: "Date to" }), _jsx(Input, { id: "dateTo", type: "date", value: dateTo, onChange: (event) => setDateTo(event.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "keyword", children: "Search" }), _jsx(Input, { id: "keyword", placeholder: "Item, customer, supplier...", value: keyword, onChange: (event) => setKeyword(event.target.value) })] })] }), _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/35 px-4 py-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-sm font-medium", children: activeReport.name }), _jsx("p", { className: "text-sm text-muted-foreground", children: activeReport.description })] }), _jsxs(Button, { onClick: () => openReport(reportHref), children: ["Open report", _jsx(ArrowRight, { className: "h-4 w-4" })] })] })] })] }), _jsx("div", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-3", children: reportOptions.map((option) => (_jsxs(Card, { className: "bg-white/95", children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { className: "text-base", children: option.name }), _jsx(CardDescription, { children: option.description })] }), _jsxs(CardContent, { className: "flex items-center justify-between gap-3 pt-0", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm text-muted-foreground", children: [_jsx(Filter, { className: "h-4 w-4" }), "Optional filters supported"] }), _jsxs(Button, { size: "sm", variant: "outline", onClick: () => openReport(option.href), children: [_jsx(CalendarDays, { className: "h-4 w-4" }), "Open"] })] })] }, option.href))) })] }));
}
