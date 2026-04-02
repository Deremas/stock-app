import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TableExportMenu } from "@/components/tables/table-export-menu";
import { slugifyExportName } from "@/lib/table-export";
import { formatCurrency, formatDateTime, toTitleCase } from "@/lib/utils";
function getStatusVariant(value) {
    const normalized = value.toUpperCase();
    if (normalized.includes("ACTIVE") ||
        normalized.includes("PAID") ||
        normalized.includes("POSTED") ||
        normalized.includes("COMPLETED") ||
        normalized.includes("RECEIVED")) {
        return "success";
    }
    if (normalized.includes("PARTIAL") ||
        normalized.includes("DRAFT") ||
        normalized.includes("CREDIT") ||
        normalized.includes("WARNING") ||
        normalized.includes("LOW")) {
        return "warning";
    }
    if (normalized.includes("CRITICAL") ||
        normalized.includes("OUT OF STOCK") ||
        normalized.includes("OPEN") ||
        normalized.includes("UNPAID") ||
        normalized.includes("VOID") ||
        normalized.includes("INACTIVE") ||
        normalized.includes("CANCEL")) {
        return "danger";
    }
    return "outline";
}
function renderCellValue(column, row) {
    const rawValue = row[column.key];
    if (rawValue === null || rawValue === undefined || rawValue === "") {
        return _jsx("span", { className: "text-muted-foreground", children: "-" });
    }
    if (column.type === "currency") {
        return formatCurrency(typeof rawValue === "number" || typeof rawValue === "string" ? rawValue : 0);
    }
    if (column.type === "dateTime") {
        return formatDateTime(String(rawValue));
    }
    if (column.type === "status") {
        return _jsx(Badge, { variant: getStatusVariant(String(rawValue)), children: toTitleCase(String(rawValue)) });
    }
    return String(rawValue);
}
export function DailyCheckTableCard({ title, description, columns, rows, exportFileName, emptyStateMessage = "No records found.", }) {
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", children: [_jsxs("div", { className: "space-y-1", children: [_jsx(CardTitle, { children: title }), _jsx(CardDescription, { children: description })] }), _jsx(TableExportMenu, { title: title, fileName: exportFileName ?? slugifyExportName(title), columns: columns, rows: rows })] }), _jsx(CardContent, { className: "min-w-0", children: rows.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground", children: emptyStateMessage })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full border-separate border-spacing-0 overflow-hidden rounded-2xl border border-border/70 text-sm", children: [_jsx("thead", { className: "bg-muted/35", children: _jsx("tr", { children: columns.map((column) => (_jsx("th", { className: "border-b border-border/70 px-3 py-2 text-left font-medium text-foreground", children: column.header }, column.key))) }) }), _jsx("tbody", { children: rows.map((row) => (_jsx("tr", { className: "bg-card align-top", children: columns.map((column) => (_jsx("td", { className: "border-b border-border/60 px-3 py-2 text-muted-foreground last:border-b-0", children: renderCellValue(column, row) }, `${row.id}-${column.key}`))) }, row.id))) })] }) })) })] }));
}
