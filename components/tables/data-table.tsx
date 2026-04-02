"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from "material-react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableExportMenu } from "@/components/tables/table-export-menu";
import {
  getSimpleColumnSizing,
  materialTableBodyCellSx,
  materialTableBodyRowSx,
  materialTableBottomToolbarSx,
  materialTableContainerSx,
  materialTableHeadCellSx,
  materialTablePaginationProps,
  materialTablePropsSx,
  materialTableSearchTextFieldProps,
  materialTableToolbarSx,
} from "@/lib/material-table";
import type { SimpleColumn, SimpleRow } from "@/lib/table";
import { getIcon } from "@/lib/icons";
import { formatCurrency, formatDateTime, toTitleCase } from "@/lib/utils";

function getStatusVariant(value: string) {
  const normalized = value.toUpperCase();

  if (
    normalized.includes("ACTIVE") ||
    normalized.includes("PAID") ||
    normalized.includes("POSTED") ||
    normalized.includes("COMPLETED") ||
    normalized.includes("RECEIVED")
  ) {
    return "success" as const;
  }

  if (
    normalized.includes("PARTIAL") ||
    normalized.includes("DRAFT") ||
    normalized.includes("CREDIT") ||
    normalized.includes("WARNING") ||
    normalized.includes("LOW")
  ) {
    return "warning" as const;
  }

  if (
    normalized.includes("CRITICAL") ||
    normalized.includes("OUT OF STOCK") ||
    normalized.includes("OPEN") ||
    normalized.includes("UNPAID") ||
    normalized.includes("VOID") ||
    normalized.includes("INACTIVE") ||
    normalized.includes("CANCEL")
  ) {
    return "danger" as const;
  }

  return "outline" as const;
}

export function DataTable({
  columns,
  data,
  exportFileName = "table-export",
  exportTitle,
}: {
  columns: SimpleColumn[];
  data: SimpleRow[];
  exportFileName?: string;
  exportTitle?: string;
}) {
  const searchParams = useSearchParams();
  const routeSearch = searchParams.get("q") ?? "";
  const [globalFilter, setGlobalFilter] = useState(routeSearch);

  useEffect(() => {
    setGlobalFilter(routeSearch);
  }, [routeSearch]);

  const mrtColumns = useMemo<MRT_ColumnDef<SimpleRow>[]>(
    () =>
      columns.map((column) => ({
        accessorKey: column.key,
        header: column.header,
        ...getSimpleColumnSizing(column),
        Cell: ({ cell }) => {
          const rawValue = cell.getValue<string | number | boolean | null | undefined>();

          if (rawValue === null || rawValue === undefined || rawValue === "") {
            return <span className="text-muted-foreground">-</span>;
          }

          if (column.type === "currency") {
            return formatCurrency(
              typeof rawValue === "number" || typeof rawValue === "string"
                ? rawValue
                : 0,
            );
          }

          if (column.type === "dateTime") {
            return formatDateTime(String(rawValue));
          }

          if (column.type === "status") {
            return (
              <Badge variant={getStatusVariant(String(rawValue))}>
                {toTitleCase(String(rawValue))}
              </Badge>
            );
          }

          if (column.type === "multiline") {
            const lines = String(rawValue)
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);

            return (
              <div className="space-y-1.5 py-0.5">
                {lines.map((line, index) => {
                  const isSummaryLine = index === 0;

                  return (
                    <div
                      key={`${column.key}-${index}-${line}`}
                      className={
                        isSummaryLine
                          ? "rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-semibold text-foreground"
                          : "rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground"
                      }
                    >
                      {line}
                    </div>
                  );
                })}
              </div>
            );
          }

          return String(rawValue);
        },
      })),
    [columns],
  );

  const hasRowActions = useMemo(
    () => data.some((row) => (row.__actions?.length ?? 0) > 0),
    [data],
  );
  const rowActionsLayout = useMemo(() => {
    const actionGroups = data.map((row) => row.__actions ?? []);
    const maxActionCount = actionGroups.reduce(
      (max, actions) => Math.max(max, actions.length),
      0,
    );
    const longestLabelLength = actionGroups.reduce(
      (max, actions) =>
        Math.max(
          max,
          ...actions.map((action) => action.label.trim().length),
          0,
        ),
      0,
    );
    const size = Math.max(
      300,
      Math.min(620, maxActionCount * 70 + (longestLabelLength >= 10 ? 70 : 40)),
    );

    return {
      size,
      minSize: Math.max(240, size - 80),
      maxSize: Math.min(680, size + 60),
      minWidth: `${Math.max(240, size - 50)}px`,
    };
  }, [data]);
  const pinnedLeftColumns = useMemo(
    () => (columns[0]?.key ? [columns[0].key] : []),
    [columns],
  );

  const table = useMaterialReactTable({
    columns: mrtColumns,
    data,
    enableGlobalFilter: true,
    enableDensityToggle: true,
    enableFullScreenToggle: true,
    enableColumnFilters: true,
    enableColumnActions: true,
    enableColumnPinning: true,
    enableHiding: true,
    enableRowActions: hasRowActions,
    enableStickyHeader: true,
    layoutMode: "grid-no-grow",
    initialState: {
      density: "compact",
      ...(routeSearch ? { showGlobalFilter: true } : {}),
      columnPinning: {
        left: pinnedLeftColumns,
        ...(hasRowActions ? { right: ["mrt-row-actions"] } : {}),
      },
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
                  size: rowActionsLayout.size,
                  minSize: rowActionsLayout.minSize,
                  maxSize: rowActionsLayout.maxSize,
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
      const exportColumns = columns.filter((column) =>
        visibleColumnKeys.includes(column.key),
      );
      const exportRows = table.getPrePaginationRowModel().rows.map((row) => row.original);

      return (
        <TableExportMenu
          title={exportTitle ?? exportFileName}
          fileName={exportFileName}
          columns={exportColumns}
          rows={exportRows}
        />
      );
    },
    renderRowActions: ({ row }) => {
      const actions = row.original.__actions ?? [];

      if (actions.length === 0) {
        return null;
      }

      return (
        <div
          className="flex flex-wrap items-center gap-1.5 py-1"
          style={{ minWidth: rowActionsLayout.minWidth }}
        >
          {actions.map((action) => {
            const Icon = getIcon(action.icon);

            return (
              <Button
                key={action.key}
                asChild
                size="sm"
                variant={action.variant ?? "outline"}
                className="h-8 whitespace-nowrap rounded-full px-2.5 text-[13px]"
              >
                <a href={action.href}>
                  <Icon className="h-4 w-4" />
                  {action.label}
                </a>
              </Button>
            );
          })}
        </div>
      );
    },
  });

  return (
    <div className="min-w-0 max-w-full overflow-x-auto">
      <MaterialReactTable table={table} />
    </div>
  );
}
