import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SimpleRow } from "@/lib/table";

export function LowStockCard({ rows }: { rows: SimpleRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Low Stock Items</CardTitle>
        <CardDescription>Items currently below their branch alert threshold.</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No low stock items right now.
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{String(row.name)}</p>
                <p className="text-xs text-muted-foreground">
                  {String(row.branch)}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-sm font-semibold">{String(row.currentStock)} pcs</p>
                <p className="text-xs text-muted-foreground">
                  Min {String(row.minimumStockAlert)}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
