"use client";

import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrendPoint } from "@/lib/types";
import { formatCompactNumber, formatCurrency } from "@/lib/utils";

export function SalesTrendChart({ data }: { data: TrendPoint[] }) {
  const [isReady, setIsReady] = useState(false);
  const [chartSize, setChartSize] = useState({ width: 0, height: 260 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsReady(true);
  }, []);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const updateSize = () => {
      setChartSize({
        width: Math.max(container.clientWidth, 0),
        height: Math.max(container.clientHeight, 260),
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Last 7 Days</CardTitle>
        <CardDescription>Branch-wide posted sales across owned and seller stock.</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 overflow-hidden">
        <div ref={containerRef} className="h-[260px] min-h-[260px] w-full min-w-0 sm:h-[320px]">
          {isReady && chartSize.width > 0 ? (
            <LineChart width={chartSize.width} height={chartSize.height} data={data}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.25)" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(value) => formatCompactNumber(Number(value))} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#0f766e"
                  strokeWidth={3}
                  dot={{ fill: "#0f766e", strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6 }}
                />
            </LineChart>
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/30 text-sm text-muted-foreground">
              Loading sales trend...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
