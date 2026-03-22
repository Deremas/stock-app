import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecentTransaction } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export function RecentTransactionsCard({
  transactions,
}: {
  transactions: RecentTransaction[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>Latest posted activity touching stock or finance ledgers.</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No posted transactions yet.
          </p>
        ) : (
          transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border/70 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <div className="min-w-0 space-y-1">
                <p className="break-words text-sm font-medium">{transaction.reference}</p>
                <p className="text-xs text-muted-foreground">
                  {transaction.type} · {transaction.branch}
                </p>
              </div>
              <div className="min-w-0 sm:text-right">
                <p className="break-words text-sm font-semibold">{formatCurrency(transaction.amount)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(transaction.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
