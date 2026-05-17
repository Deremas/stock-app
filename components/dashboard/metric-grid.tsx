import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { MetricCard } from "@/lib/types";
import { cn } from "@/lib/utils";

const toneIconMap = {
  default: Wallet,
  success: ArrowDownToLine,
  warning: AlertTriangle,
  danger: ArrowUpFromLine,
} as const;

export function MetricGrid({
  metrics,
  mobileColumns = 1,
}: {
  metrics: MetricCard[];
  mobileColumns?: 1 | 2;
}) {
  const compactMobile = mobileColumns === 2;

  return (
    <div
      className={cn(
        "grid min-w-0 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        compactMobile && "grid-cols-2 max-[359px]:grid-cols-1",
      )}
    >
      {metrics.map((metric) => {
        const Icon = toneIconMap[metric.tone ?? "default"];

        return (
          <Card key={metric.title}>
            <CardContent className={cn("p-5", compactMobile && "p-4 sm:p-5")}>
              <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
                <div className="min-w-0 space-y-1.5 sm:space-y-2">
                  <p
                    className={cn(
                      "text-sm text-muted-foreground",
                      compactMobile && "text-xs leading-4 sm:text-sm",
                    )}
                  >
                    {metric.title}
                  </p>
                  <p
                    className={cn(
                      "break-words text-xl font-semibold tracking-tight sm:text-2xl",
                      compactMobile && "text-lg sm:text-2xl",
                    )}
                  >
                    {metric.value}
                  </p>
                  {metric.meta ? (
                    <p
                      className={cn(
                        "text-xs text-muted-foreground",
                        compactMobile && "text-[11px] leading-4 sm:text-xs",
                      )}
                    >
                      {metric.meta}
                    </p>
                  ) : null}
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 rounded-xl px-2 py-2",
                    compactMobile && "px-1.5 py-1.5 sm:px-2 sm:py-2",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
