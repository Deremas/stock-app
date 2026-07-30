"use client";

import type { Route } from "next";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Filter } from "lucide-react";

import type { BranchOption } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const reportOptions = [
  {
    id: "daily-check",
    name: "Daily Check",
    description: "Daily sales, partner, payout, collection, and return snapshot.",
    href: "/sales/daily-check",
  },
  {
    id: "sales-profit",
    name: "Sales Profit",
    description: "Daily sales with cost, seller payable, and gross profit.",
    href: "/reports/sales",
  },
  {
    id: "discounts-report",
    name: "Discounts Report",
    description: "Detailed discounts metrics and list of all discounted sales items.",
    href: "/reports/discounts",
  },
  {
    id: "partner-exposure",
    name: "Seller Exposure",
    description:
      "Open received stock, assigned-out stock, unpaid payables, and uncollected receivables.",
    href: "/reports/sellers",
  },
  {
    id: "expense-summary",
    name: "Expense Summary",
    description: "Expense totals by category for daily, weekly, and monthly review.",
    href: "/reports/finance",
  },
  {
    id: "stock-overview",
    name: "Current Stock",
    description: "Current stock by item and branch.",
    href: "/inventory/stock",
  },
  {
    id: "inventory-adjustments",
    name: "Inventory Adjustments",
    description:
      "Audited buying-price, selling-price, and quantity corrections by stock batch.",
    href: "/reports/inventory-adjustments",
  },
  {
    id: "bin-card",
    name: "Item Bin Card",
    description:
      "Per-item movement ledger with dated quantity in, quantity out, and running balance.",
    href: "/reports/bin-card",
  },
  {
    id: "low-stock",
    name: "Low Stock",
    description: "Items that need replenishment soon.",
    href: "/inventory/low-stock",
  },
  {
    id: "sold-items",
    name: "Sold Items",
    description: "Line-level sales history for items sold.",
    href: "/sales/sold-items",
  },
  {
    id: "customer-credit",
    name: "Customer Credit",
    description: "Outstanding customer balances and aging.",
    href: "/sales/customer-credit",
  },
  {
    id: "purchase-list",
    name: "Purchase List",
    description: "Supplier purchases with totals and balances.",
    href: "/purchases/list",
  },
  {
    id: "seller-settlements",
    name: "Seller Payments",
    description: "Seller payout history with exact received-stock lines paid.",
    href: "/sellers/settlements",
  },
  {
    id: "seller-collections",
    name: "Seller Collections",
    description: "Cash and bank collections posted for sold assigned items.",
    href: "/sellers/collections",
  },
  {
    id: "seller-returns",
    name: "Seller Returns",
    description: "Unsold items returned either back to the seller or into branch stock.",
    href: "/sellers/returns",
  },
  {
    id: "seller-intakes",
    name: "Seller Received Records",
    description: "Received seller stock with sold, returned, and remaining quantities.",
    href: "/sellers/intake-records",
  },
] as const;

export function ReportsHub({ branches }: { branches: BranchOption[] }) {
  const router = useRouter();
  const [reportHref, setReportHref] = useState<string>(reportOptions[0]?.href ?? "/reports");
  const [branchId, setBranchId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [keyword, setKeyword] = useState("");

  const activeReport = useMemo(
    () => reportOptions.find((option) => option.href === reportHref) ?? reportOptions[0],
    [reportHref],
  );

  function openReport(targetHref: string) {
    const url = new URL(targetHref, window.location.origin);

    if (branchId) {
      url.searchParams.set("branchId", branchId);
    }
    if (dateFrom) {
      url.searchParams.set("dateFrom", dateFrom);
    }
    if (dateTo) {
      url.searchParams.set("dateTo", dateTo);
    }
    if (keyword.trim()) {
      url.searchParams.set("q", keyword.trim());
    }

    router.push(`${url.pathname}${url.search}` as Route);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Open a report</CardTitle>
          <CardDescription>
            Choose the report you want, apply the basic filters, then open it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reportHref">Report</Label>
              <Select
                id="reportHref"
                value={reportHref}
                onChange={(event) => setReportHref(event.target.value)}
              >
                {reportOptions.map((option) => (
                  <option key={option.href} value={option.href}>
                    {option.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branchId">Branch</Label>
              <Select
                id="branchId"
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
              >
                <option value="">All branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} - {branch.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Date from</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">Date to</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keyword">Search</Label>
              <Input
                id="keyword"
                placeholder="Item, customer, supplier..."
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/35 px-4 py-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">{activeReport.name}</p>
              <p className="text-sm text-muted-foreground">{activeReport.description}</p>
            </div>
            <Button onClick={() => openReport(reportHref)}>
              Open report
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportOptions.map((option) => (
          <Card key={option.href} className="bg-white/95">
            <CardHeader>
              <CardTitle className="text-base">{option.name}</CardTitle>
              <CardDescription>{option.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3 pt-0">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                Optional filters supported
              </div>
              <Button size="sm" variant="outline" onClick={() => openReport(option.href)}>
                <CalendarDays className="h-4 w-4" />
                Open
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
