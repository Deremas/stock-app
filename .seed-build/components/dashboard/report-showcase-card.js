import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChartColumnIncreasing, HandCoins, ReceiptText, } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
const reportShortcuts = [
    {
        title: "Daily Check",
        description: "Open the daily sales, partner, payment, collection, and return snapshot.",
        href: "/sales/daily-check",
        icon: CalendarDays,
    },
    {
        title: "Sales Profit",
        description: "See what was sold, cost used, and gross profit.",
        href: "/reports/sales",
        icon: ChartColumnIncreasing,
    },
    {
        title: "Partner Exposure",
        description: "See partner items still on hand and unpaid balances.",
        href: "/reports/sellers",
        icon: HandCoins,
    },
    {
        title: "Expense Summary",
        description: "Review spending by category for the selected period.",
        href: "/reports/finance",
        icon: ReceiptText,
    },
];
export function ReportShowcaseCard() {
    return (_jsxs(Card, { className: "h-full", children: [_jsxs(CardHeader, { className: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(CardTitle, { children: "Helpful Reports" }), _jsx(CardDescription, { children: "Start with the simplest views for daily checking." })] }), _jsx(Button, { asChild: true, size: "sm", variant: "outline", children: _jsx(Link, { href: "/reports", children: "All reports" }) })] }), _jsx(CardContent, { className: "grid grid-cols-2 gap-3 max-[359px]:grid-cols-1", children: reportShortcuts.map((report) => {
                    const Icon = report.icon;
                    return (_jsx(Link, { href: report.href, className: "group rounded-2xl border border-border/70 bg-background/80 p-3 transition hover:border-primary/30 hover:bg-accent/40 sm:p-4", children: _jsxs("div", { className: "flex min-h-full min-w-0 flex-col justify-between gap-3", children: [_jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [_jsx("span", { className: "mt-0.5 rounded-xl border border-border/70 bg-card p-1.5 text-primary sm:p-2", children: _jsx(Icon, { className: "h-4 w-4" }) }), _jsxs("div", { className: "min-w-0 space-y-1", children: [_jsx("p", { className: "text-xs font-semibold sm:text-sm", children: report.title }), _jsx("p", { className: "text-[11px] leading-4 text-muted-foreground sm:text-xs sm:leading-5", children: report.description })] })] }), _jsxs("div", { className: "flex items-center gap-1 text-xs font-medium text-primary sm:text-sm", children: ["Open", _jsx(ArrowRight, { className: "h-4 w-4 transition group-hover:translate-x-0.5" })] })] }) }, report.href));
                }) })] }));
}
