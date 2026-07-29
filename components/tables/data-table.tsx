"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Eye } from "lucide-react";
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
import { cn, formatCurrency, formatDateTime, toTitleCase } from "@/lib/utils";

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
    normalized.includes("CANCEL") ||
    normalized.startsWith("-")
  ) {
    return "danger" as const;
  }

  if (normalized.startsWith("+")) {
    return "success" as const;
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
  const isMobile = useMediaQuery("(max-width: 640px)");
  const searchParams = useSearchParams();
  const routeSearch = searchParams.get("q") ?? "";
  const [globalFilter, setGlobalFilter] = useState(routeSearch);

  const columnVisibility = useMemo(() => {
    const visibility: Record<string, boolean> = {};
    columns.forEach((column) => {
      if (column.defaultHidden || (isMobile && column.hideOnMobile)) {
        visibility[column.key] = false;
      }
    });
    return visibility;
  }, [isMobile, columns]);

  useEffect(() => {
    setGlobalFilter(routeSearch);
  }, [routeSearch]);

  const mrtColumns = useMemo<MRT_ColumnDef<SimpleRow>[]>(
    () =>
      columns.map((column) => ({
        accessorKey: column.key,
        header: column.header,
        ...getSimpleColumnSizing(column),
        muiTableHeadCellProps: {
          align:
            column.align ??
            (column.type === "number" || column.type === "currency"
              ? "center"
              : "left"),
        },
        muiTableBodyCellProps: {
          align:
            column.align ??
            (column.type === "number" || column.type === "currency"
              ? "center"
              : "left"),
        },
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

          return (
            <div className="max-w-[280px] truncate" title={String(rawValue)}>
              {String(rawValue)}
            </div>
          );
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
    
    let totalWidth = 0;
    actionGroups.forEach(group => {
      let groupWidth = 0;
      group.forEach(action => {
        groupWidth += action.showLabel ? 110 : 42;
      });
      totalWidth = Math.max(totalWidth, groupWidth);
    });

    const size = Math.max(80, totalWidth + 32);

    return {
      size,
      minSize: Math.max(70, size - 15),
      maxSize: Math.min(600, size + 50),
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
      columnVisibility,
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
              muiTableHeadCellProps: {
                align: "center",
              },
              muiTableBodyCellProps: {
                align: "center",
              },
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
        <div className="flex items-center justify-center gap-1 py-1">
          {actions.map((action) => {
            const Icon = getIcon(action.icon) || Eye;
            const showLabel = action.showLabel;

            return (
              <Button
                key={action.key}
                asChild
                size={showLabel ? "sm" : "icon"}
                variant={action.variant ?? "outline"}
                title={action.label}
                className={cn(
                  "h-7 rounded-lg transition-all",
                  showLabel ? "w-auto px-2.5 gap-1.5" : "w-7"
                )}
              >
                <a href={action.href} className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4 shrink-0" />
                  {showLabel ? (
                    <span className="text-xs font-bold tracking-tight">{action.label}</span>
                  ) : (
                    <span className="sr-only">{action.label}</span>
                  )}
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
