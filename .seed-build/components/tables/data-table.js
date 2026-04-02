"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MaterialReactTable, useMaterialReactTable, } from "material-react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableExportMenu } from "@/components/tables/table-export-menu";
import { getSimpleColumnSizing, materialTableBodyCellSx, materialTableBodyRowSx, materialTableBottomToolbarSx, materialTableContainerSx, materialTableHeadCellSx, materialTablePaginationProps, materialTablePropsSx, materialTableSearchTextFieldProps, materialTableToolbarSx, } from "@/lib/material-table";
import { getIcon } from "@/lib/icons";
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
export function DataTable({ columns, data, exportFileName = "table-export", exportTitle, }) {
    const searchParams = useSearchParams();
    const routeSearch = searchParams.get("q") ?? "";
    const [globalFilter, setGlobalFilter] = useState(routeSearch);
    useEffect(() => {
        setGlobalFilter(routeSearch);
    }, [routeSearch]);
    const mrtColumns = useMemo(() => columns.map((column) => ({
        accessorKey: column.key,
        header: column.header,
        ...getSimpleColumnSizing(column),
        Cell: ({ cell }) => {
            const rawValue = cell.getValue();
            if (rawValue === null || rawValue === undefined || rawValue === "") {
                return _jsx("span", { className: "text-muted-foreground", children: "-" });
            }
            if (column.type === "currency") {
                return formatCurrency(typeof rawValue === "number" || typeof rawValue === "string"
                    ? rawValue
                    : 0);
            }
            if (column.type === "dateTime") {
                return formatDateTime(String(rawValue));
            }
            if (column.type === "status") {
                return (_jsx(Badge, { variant: getStatusVariant(String(rawValue)), children: toTitleCase(String(rawValue)) }));
            }
            if (column.type === "multiline") {
                const lines = String(rawValue)
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean);
                return (_jsx("div", { className: "space-y-1.5 py-0.5", children: lines.map((line, index) => {
                        const isSummaryLine = index === 0;
                        return (_jsx("div", { className: isSummaryLine
                                ? "rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-semibold text-foreground"
                                : "rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground", children: line }, `${column.key}-${index}-${line}`));
                    }) }));
            }
            return String(rawValue);
        },
    })), [columns]);
    const hasRowActions = useMemo(() => data.some((row) => (row.__actions?.length ?? 0) > 0), [data]);
    const table = useMaterialReactTable({
        columns: mrtColumns,
        data,
        enableGlobalFilter: true,
        enableDensityToggle: true,
        enableFullScreenToggle: true,
        enableColumnFilters: true,
        enableColumnActions: true,
        enableHiding: true,
        enableRowActions: hasRowActions,
        enableStickyHeader: true,
        layoutMode: "grid-no-grow",
        initialState: {
            density: "compact",
            ...(routeSearch ? { showGlobalFilter: true } : {}),
            pagination: {
                pageIndex: 0,
                pageSize: 20,
            },
        },
        state: {
            globalFilter,
        },
        onGlobalFilterChange: setGlobalFilter,
        positionActionsColumn: "last",
        ...(hasRowActions
            ? {
                displayColumnDefOptions: {
                    "mrt-row-actions": {
                        header: "Actions",
                        size: 300,
                        minSize: 240,
                        maxSize: 340,
                    },
                },
            }
            : {}),
        muiTablePaperProps: {
            elevation: 0,
            sx: {
                borderRadius: "1rem",
                backgroundColor: "transparent",
                boxShadow: "none",
            },
        },
        muiTableContainerProps: {
            sx: {
                ...materialTableContainerSx,
            },
        },
        muiTableProps: {
            sx: materialTablePropsSx,
        },
        muiTopToolbarProps: {
            sx: materialTableToolbarSx,
        },
        muiBottomToolbarProps: {
            sx: materialTableBottomToolbarSx,
        },
        muiTableHeadCellProps: {
            sx: materialTableHeadCellSx,
        },
        muiTableBodyCellProps: {
            sx: materialTableBodyCellSx,
        },
        muiTableBodyRowProps: {
            sx: materialTableBodyRowSx,
        },
        muiSearchTextFieldProps: materialTableSearchTextFieldProps,
        muiPaginationProps: materialTablePaginationProps,
        renderTopToolbarCustomActions: ({ table }) => {
            const visibleColumnKeys = table.getVisibleLeafColumns().map((column) => column.id);
            const exportColumns = columns.filter((column) => visibleColumnKeys.includes(column.key));
            const exportRows = table.getPrePaginationRowModel().rows.map((row) => row.original);
            return (_jsx(TableExportMenu, { title: exportTitle ?? exportFileName, fileName: exportFileName, columns: exportColumns, rows: exportRows }));
        },
        renderRowActions: ({ row }) => {
            const actions = row.original.__actions ?? [];
            if (actions.length === 0) {
                return null;
            }
            return (_jsx("div", { className: "flex min-w-[240px] flex-wrap items-center gap-2 py-1", children: actions.map((action) => {
                    const Icon = getIcon(action.icon);
                    return (_jsx(Button, { asChild: true, size: "sm", variant: action.variant ?? "outline", className: "h-8 rounded-full px-3", children: _jsxs("a", { href: action.href, children: [_jsx(Icon, { className: "h-4 w-4" }), action.label] }) }, action.key));
                }) }));
        },
    });
    return (_jsx("div", { className: "min-w-0 max-w-full overflow-x-auto", children: _jsx(MaterialReactTable, { table: table }) }));
}
