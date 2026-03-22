"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrendPoint } from "@/lib/types";
import { formatCompactNumber, formatCurrency } from "@/lib/utils";

export function SalesTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Last 7 Days</CardTitle>
        <CardDescription>Branch-wide posted sales across owned and seller stock.</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 overflow-hidden px-3 pb-4 pt-0 sm:px-6 sm:pb-6">
        <div className="relative min-w-0">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center">
            <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-medium tracking-[0.08em] text-muted-foreground sm:text-xs">
              Sales (ETB)
            </span>
          </div>
          <div className="h-[260px] min-h-[260px] w-full min-w-0 pl-5 sm:h-[320px] sm:pl-6">
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data}
                  margin={{ top: 10, right: 10, bottom: 4, left: -18 }}
                >
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.25)" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    minTickGap={0}
                    tickMargin={10}
                    tick={{ fontSize: 12, fill: "rgb(100 116 139)" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickMargin={6}
                    width={40}
                    tick={{ fontSize: 12, fill: "rgb(100 116 139)" }}
                    tickFormatter={(value) => formatCompactNumber(Number(value))}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{
                      borderRadius: "14px",
                      borderColor: "rgba(148,163,184,0.3)",
                      boxShadow: "0 18px 40px rgba(15,23,42,0.12)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#0f766e"
                    strokeWidth={3}
                    dot={{ fill: "#0f766e", strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/30 text-sm text-muted-foreground">
                Loading sales trend...
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
