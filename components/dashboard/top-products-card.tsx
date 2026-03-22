import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TopProductCardItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function TopProductsCard({ products }: { products: TopProductCardItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Value Items</CardTitle>
        <CardDescription>Items currently carrying the largest on-hand stock value.</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No stock has been posted yet.
          </p>
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {product.currentStock} pcs on hand
                </p>
              </div>
              <p className="break-words text-sm font-semibold sm:text-right">
                {formatCurrency(product.value)}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
