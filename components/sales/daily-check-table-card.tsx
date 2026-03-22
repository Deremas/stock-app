import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TableExportMenu } from "@/components/tables/table-export-menu";
import type { SimpleColumn, SimpleRow } from "@/lib/table";
import { slugifyExportName } from "@/lib/table-export";
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

function renderCellValue(column: SimpleColumn, row: SimpleRow) {
  const rawValue = row[column.key];

  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return <span className="text-muted-foreground">-</span>;
  }

  if (column.type === "currency") {
    return formatCurrency(typeof rawValue === "number" || typeof rawValue === "string" ? rawValue : 0);
  }

  if (column.type === "dateTime") {
    return formatDateTime(String(rawValue));
  }

  if (column.type === "status") {
    return <Badge variant={getStatusVariant(String(rawValue))}>{toTitleCase(String(rawValue))}</Badge>;
  }

  return String(rawValue);
}

export function DailyCheckTableCard({
  title,
  description,
  columns,
  rows,
  exportFileName,
  emptyStateMessage = "No records found.",
}: {
  title: string;
  description: string;
  columns: SimpleColumn[];
  rows: SimpleRow[];
  exportFileName?: string;
  emptyStateMessage?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <TableExportMenu
          title={title}
          fileName={exportFileName ?? slugifyExportName(title)}
          columns={columns}
          rows={rows}
        />
      </CardHeader>
      <CardContent className="min-w-0">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyStateMessage}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-2xl border border-border/70 text-sm">
              <thead className="bg-muted/35">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className="border-b border-border/70 px-3 py-2 text-left font-medium text-foreground"
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="bg-card align-top">
                    {columns.map((column) => (
                      <td
                        key={`${row.id}-${column.key}`}
                        className="border-b border-border/60 px-3 py-2 text-muted-foreground last:border-b-0"
                      >
                        {renderCellValue(column, row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
