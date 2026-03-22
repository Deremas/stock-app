import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SimpleRow } from "@/lib/table";

export function LowStockCard({ rows }: { rows: SimpleRow[] }) {
  const previewRows = rows.slice(0, 5);
  const remainingCount = Math.max(rows.length - previewRows.length, 0);

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
          previewRows.map((row) => (
            <div
              key={row.id}
              className="min-w-0 rounded-2xl border border-border/70 p-4"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{String(row.name)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {String(row.branch)}
                  </p>
                </div>
                <p className="shrink-0 whitespace-nowrap text-sm font-semibold">
                  {String(row.currentStock)} pcs
                </p>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <p className="truncate">{String(row.status)}</p>
                <p className="shrink-0 whitespace-nowrap">
                  Min {String(row.minimumStockAlert)}
                </p>
              </div>
            </div>
          ))
        )}
        {remainingCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            Showing {previewRows.length} of {rows.length} low stock items.
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild size="sm" variant="outline" className="sm:flex-1">
            <Link href="/inventory/low-stock">See all low stock items</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="sm:flex-1">
            <Link href="/inventory/out-of-stock">See out of stock items</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
