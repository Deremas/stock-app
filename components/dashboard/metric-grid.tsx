import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { MetricCard } from "@/lib/types";

const toneIconMap = {
  default: Wallet,
  success: ArrowDownToLine,
  warning: AlertTriangle,
  danger: ArrowUpFromLine,
} as const;

export function MetricGrid({ metrics }: { metrics: MetricCard[] }) {
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map((metric) => {
        const Icon = toneIconMap[metric.tone ?? "default"];

        return (
          <Card key={metric.title}>
            <CardContent className="p-5">
              <div className="flex min-w-0 items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <p className="text-sm text-muted-foreground">{metric.title}</p>
                  <p className="break-words text-xl font-semibold tracking-tight sm:text-2xl">
                    {metric.value}
                  </p>
                  {metric.meta ? <p className="text-xs text-muted-foreground">{metric.meta}</p> : null}
                </div>
                <Badge variant="outline" className="shrink-0 rounded-xl px-2 py-2">
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
