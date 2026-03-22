"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from "material-react-table";
import { Download } from "lucide-react";
import { utils, writeFileXLSX } from "xlsx";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
}: {
  columns: SimpleColumn[];
  data: SimpleRow[];
  exportFileName?: string;
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

          return String(rawValue);
        },
      })),
    [columns],
  );

  const hasRowActions = useMemo(
    () => data.some((row) => (row.__actions?.length ?? 0) > 0),
    [data],
  );

  function handleExport() {
    const exportRows = data.map((row) =>
      Object.fromEntries(columns.map((column) => [column.header, row[column.key] ?? ""])),
    );
    const worksheet = utils.json_to_sheet(exportRows);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Data");
    writeFileXLSX(workbook, `${exportFileName}.xlsx`);
  }

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
    renderTopToolbarCustomActions: () => (
      <Button onClick={handleExport} size="sm" variant="outline">
        <Download className="h-4 w-4" />
        Export
      </Button>
    ),
    renderRowActions: ({ row }) => {
      const actions = row.original.__actions ?? [];

      if (actions.length === 0) {
        return null;
      }

      return (
        <div className="flex min-w-[240px] flex-wrap items-center gap-2 py-1">
          {actions.map((action) => {
            const Icon = getIcon(action.icon);

            return (
              <Button
                key={action.key}
                asChild
                size="sm"
                variant={action.variant ?? "outline"}
                className="h-8 rounded-full px-3"
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
