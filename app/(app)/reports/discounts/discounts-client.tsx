"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Filter, Search, Tag, X } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type BranchOption = {
  id: string;
  name: string;
};

type DiscountedItem = {
  id: string;
  soldAt: string;
  saleNumber: string;
  branch: string;
  product: string;
  customer: string;
  quantity: number;
  unitPrice: number;
  discountPerUnit: number;
  fixedDiscount: number;
  totalDiscount: number;
  lineTotal: number;
};

type DiscountsClientProps = {
  items: DiscountedItem[];
  branches: BranchOption[];
  kpis: {
    totalDiscount: number;
    averageRate: number;
    mostDiscountedProduct: string;
    mostDiscountedAmount: number;
  };
};

export function DiscountsClient({ items, branches, kpis }: DiscountsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Load initial filter states from URL search params
  const [branchId, setBranchId] = useState(searchParams.get("branchId") || "all");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [q, setQ] = useState(searchParams.get("q") || "");

  function applyFilters() {
    const params = new URLSearchParams();
    if (branchId && branchId !== "all") params.set("branchId", branchId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (q.trim()) params.set("q", q.trim());
    router.push(`?${params.toString()}`);
  }

  function resetFilters() {
    setBranchId("all");
    setDateFrom("");
    setDateTo("");
    setQ("");
    router.push("?");
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Discounts Report"
        description="Analyze price reductions, average discount rates, and itemized customer discount profiles."
      />

      {/* High-density KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Discounts
            </span>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">
              ETB {kpis.totalDiscount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-xs text-slate-500">Total discount value applied</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Average Discount Rate
            </span>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">
              {kpis.averageRate.toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-slate-500">Of undiscounted retail revenue</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Most Discounted Item
            </span>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-slate-900 truncate" title={kpis.mostDiscountedProduct}>
              {kpis.mostDiscountedProduct || "None"}
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              {kpis.mostDiscountedAmount > 0
                ? `Total: ETB ${kpis.mostDiscountedAmount.toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                  })}`
                : "No discounts applied"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Control Box */}
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-slate-700">
            <Filter className="h-4 w-4" /> Filter Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {/* Branch Select */}
            <div className="space-y-1.5">
              <label htmlFor="filter-branch" className="text-xs font-semibold text-slate-500">
                Branch
              </label>
              <select
                id="filter-branch"
                className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-sm focus:outline-none"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="all">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className="space-y-1.5">
              <label htmlFor="filter-date-from" className="text-xs font-semibold text-slate-500">
                Date From
              </label>
              <Input
                id="filter-date-from"
                type="date"
                className="h-9 rounded-xl border-slate-300"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            {/* Date To */}
            <div className="space-y-1.5">
              <label htmlFor="filter-date-to" className="text-xs font-semibold text-slate-500">
                Date To
              </label>
              <Input
                id="filter-date-to"
                type="date"
                className="h-9 rounded-xl border-slate-300"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {/* Product Query */}
            <div className="space-y-1.5">
              <label htmlFor="filter-query" className="text-xs font-semibold text-slate-500">
                Search Product
              </label>
              <div className="relative">
                <Input
                  id="filter-query"
                  placeholder="Enter product name..."
                  className="h-9 pr-9 rounded-xl border-slate-300"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full px-4"
              onClick={resetFilters}
            >
              <X className="mr-1.5 h-3.5 w-3.5" /> Reset
            </Button>
            <Button size="sm" className="rounded-full px-4" onClick={applyFilters}>
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Table Card */}
      <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
              <tr>
                <th className="px-6 py-3 font-semibold">Sold At</th>
                <th className="px-6 py-3 font-semibold">Sale No.</th>
                <th className="px-6 py-3 font-semibold">Branch</th>
                <th className="px-6 py-3 font-semibold">Product</th>
                <th className="px-6 py-3 font-semibold">Customer</th>
                <th className="px-6 py-3 font-semibold text-center">Qty</th>
                <th className="px-6 py-3 text-right font-semibold">Unit Price</th>
                <th className="px-6 py-3 text-right font-semibold">Disc/Qty</th>
                <th className="px-6 py-3 text-right font-semibold">Fixed Disc</th>
                <th className="px-6 py-3 text-right font-semibold">Total Disc</th>
                <th className="px-6 py-3 text-right font-semibold">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-10 text-center text-slate-400">
                    No discounted items found for the current filter criteria.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      {new Date(item.soldAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap font-medium">
                      {item.saleNumber}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">{item.branch}</td>
                    <td className="px-6 py-3.5 whitespace-nowrap font-medium">
                      {item.product}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">{item.customer}</td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-center font-semibold">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-right">
                      ETB {item.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-right text-rose-600 font-medium">
                      {item.discountPerUnit > 0
                        ? `ETB ${item.discountPerUnit.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}`
                        : "-"}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-right text-rose-600 font-medium">
                      {item.fixedDiscount > 0
                        ? `ETB ${item.fixedDiscount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}`
                        : "-"}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-right font-bold text-rose-700">
                      ETB {item.totalDiscount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-right font-semibold">
                      ETB {item.lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
