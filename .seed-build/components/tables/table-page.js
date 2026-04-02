import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import Link from "next/link";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell/page-header";
export function TablePage({ config }) {
    const headerProps = {
        title: config.title,
        description: config.description,
        ...(config.eyebrow ? { eyebrow: config.eyebrow } : {}),
    };
    const tableProps = {
        columns: config.columns,
        data: config.rows,
        exportTitle: config.title,
        ...(config.exportFileName ? { exportFileName: config.exportFileName } : {}),
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start", children: [_jsx("div", { className: "min-w-0", children: _jsx(PageHeader, { ...headerProps }) }), config.actionLabel && config.actionHref ? (_jsx("div", { className: "justify-self-end", children: _jsx(Button, { asChild: true, size: "sm", children: _jsx(Link, { href: config.actionHref, children: config.actionLabel }) }) })) : null] }), config.kpis?.length ? _jsx(MetricGrid, { metrics: config.kpis }) : null, _jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsx(DataTable, { ...tableProps }) }) })] }));
}
