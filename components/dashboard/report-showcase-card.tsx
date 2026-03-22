import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, ChartColumnIncreasing, HandCoins, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ReportShortcut = {
  title: string;
  description: string;
  href: Route;
  icon: typeof ChartColumnIncreasing;
};

const reportShortcuts: ReportShortcut[] = [
  {
    title: "Sales Profit",
    description: "See what was sold, cost used, and gross profit.",
    href: "/reports/sales",
    icon: ChartColumnIncreasing,
  },
  {
    title: "Partner Exposure",
    description: "See partner items still on hand and unpaid balances.",
    href: "/reports/sellers",
    icon: HandCoins,
  },
  {
    title: "Expense Summary",
    description: "Review spending by category for the selected period.",
    href: "/reports/finance",
    icon: ReceiptText,
  },
];

export function ReportShowcaseCard() {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Helpful Reports</CardTitle>
          <CardDescription>Start with the simplest views for daily checking.</CardDescription>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/reports">All reports</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {reportShortcuts.map((report) => {
          const Icon = report.icon;

          return (
            <Link
              key={report.href}
              href={report.href}
              className="group flex items-start justify-between gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 transition hover:border-primary/30 hover:bg-accent/40"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 rounded-xl border border-border/70 bg-card p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold">{report.title}</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {report.description}
                  </p>
                </div>
              </div>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
