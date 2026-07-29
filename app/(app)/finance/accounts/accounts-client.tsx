"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CreditCard,
  Plus,
  Search,
  Edit,
  ArrowUpRight,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FinanceAccountForm } from "@/components/forms/finance-account-form";
import type { FinanceAccountFormOptions } from "@/lib/types";

type AccountItem = {
  id: string;
  code: string;
  name: string;
  type: "BANK" | "CASH";
  bankName: string | null;
  accountNumber: string | null;
  isActive: boolean;
  balance: number;
};

type TransactionItem = {
  id: string;
  entryDate: string;
  branch: string;
  accountName: string;
  type: string;
  direction: "DEBIT" | "CREDIT";
  amount: number;
  reference: string;
  description: string | null;
};

type AccountsClientProps = {
  accounts: AccountItem[];
  transactions: TransactionItem[];
  options: FinanceAccountFormOptions;
  branches: { id: string; name: string }[];
};

export function AccountsClient({
  accounts,
  transactions,
  options,
  branches,
}: AccountsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountItem | null>(null);

  // Read current filters from URL
  const activeAccountId = searchParams.get("accountId") || "all";
  const activeType = searchParams.get("type") || "all";
  const activeBranch = searchParams.get("branch") || "all";
  const searchQuery = searchParams.get("q") || "";

  const [searchVal, setSearchVal] = useState(searchQuery);

  function updateFilters(newParams: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, val]) => {
      if (val === null || val === "all") {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });
    router.push(`?${params.toString()}`);
  }

  // Handle Search Input Submission
  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateFilters({ q: searchVal || null });
  }

  // Clear All Filters
  function clearAllFilters() {
    setSearchVal("");
    router.push("?");
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Finance Accounts"
          description="Manage shared corporate bank credentials and view detailed transaction logs across all branches."
        />
        <Button
          size="sm"
          className="w-full sm:w-auto rounded-full px-5 shadow-md"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Account
        </Button>
      </div>

      {/* Credit Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {accounts.map((acc) => {
          const isCash = acc.type === "CASH";
          const inactive = !acc.isActive;

          // Theme gradients based on account type
          const gradientClass = inactive
            ? "from-slate-700 via-slate-800 to-slate-900 border-slate-700/50 shadow-slate-950/20"
            : isCash
              ? "from-emerald-600 via-teal-700 to-cyan-800 border-emerald-500/30 shadow-emerald-950/20"
              : "from-indigo-600 via-purple-700 to-pink-700 border-indigo-500/30 shadow-indigo-950/20";

          return (
            <div
              key={acc.id}
              className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 text-white shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${gradientClass}`}
            >
              {/* Card Hologram Chip */}
              <div className="flex items-start justify-between">
                <div className="h-9 w-12 rounded bg-amber-400/80 shadow-inner backdrop-blur-sm" />
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
                  <CreditCard className="h-4 w-4 opacity-90" />
                </div>
              </div>

              {/* Account Details */}
              <div className="mt-8 space-y-1">
                <p className="text-xs font-semibold tracking-widest text-white/70 uppercase">
                  {isCash ? "Global Cash Account" : acc.bankName || "Bank Account"}
                </p>
                <h3 className="text-xl font-bold truncate leading-tight">{acc.name}</h3>
              </div>

              {/* Account Number */}
              <div className="mt-4 font-mono text-[15px] tracking-widest opacity-80">
                {isCash
                  ? "**** **** **** CASH"
                  : acc.accountNumber
                    ? `**** **** **** ${acc.accountNumber.slice(-4)}`
                    : "**** **** **** ****"}
              </div>

              {/* Balance & Actions */}
              <div className="mt-8 flex items-end justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/60">
                    Current Balance
                  </p>
                  <p className="text-2xl font-bold leading-none">
                    ETB {acc.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full bg-white/10 text-white hover:bg-white/20"
                    onClick={() => setEditingAccount(acc)}
                    title="Edit account details"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full bg-white/10 text-white hover:bg-white/20"
                    onClick={() => updateFilters({ accountId: acc.id })}
                    title="Filter ledger by this account"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Holographic lines */}
              <div className="absolute right-0 top-0 h-40 w-40 translate-x-12 translate-y-[-20px] rounded-full bg-white/5 blur-3xl pointer-events-none" />
            </div>
          );
        })}
      </div>

      {/* Ledger & Transactions Table Section */}
      <div className="space-y-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Transaction Ledger
          </h2>
          <p className="text-sm text-slate-500">
            Realtime audit log of ledger postings tied to cash or bank balances.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 items-end">
          {/* Account Filter */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-500">Account</span>
            <select
              className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-sm focus-visible:ring-primary/85 focus:outline-none"
              value={activeAccountId}
              onChange={(e) => updateFilters({ accountId: e.target.value })}
            >
              <option value="all">All Accounts</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.type})
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-500">Entry Type</span>
            <select
              className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-sm focus-visible:ring-primary/85 focus:outline-none"
              value={activeType}
              onChange={(e) => updateFilters({ type: e.target.value })}
            >
              <option value="all">All Types</option>
              <option value="OPENING_BALANCE">Opening Balance</option>
              <option value="SUPPLIER_PAYMENT">Supplier Payment</option>
              <option value="CUSTOMER_PAYMENT">Customer Payment</option>
              <option value="CASH_TRANSFER">Cash Deposit/Transfer</option>
              <option value="EXPENSE">Expense</option>
              <option value="SALE">Sale Ledger</option>
            </select>
          </div>

          {/* Branch Filter */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-500">Branch</span>
            <select
              className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-sm focus-visible:ring-primary/85 focus:outline-none"
              value={activeBranch}
              onChange={(e) => updateFilters({ branch: e.target.value })}
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Text Search */}
          <form onSubmit={handleSearchSubmit} className="space-y-1.5 md:col-span-1 lg:col-span-2">
            <span className="text-xs font-semibold text-slate-500">Search description</span>
            <div className="relative">
              <Input
                className="h-9 pr-9 rounded-xl border-slate-300 bg-white placeholder:text-slate-400 focus-visible:ring-primary/85"
                placeholder="Search reference or description..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
              />
              <button
                type="submit"
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Clear Filters Button (If filtering) */}
        {(activeAccountId !== "all" ||
          activeType !== "all" ||
          activeBranch !== "all" ||
          searchVal !== "") && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 rounded-full text-slate-500 hover:text-slate-900"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Reset Filters
            </Button>
          </div>
        )}

        {/* Ledger Entries Table */}
        <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                <tr>
                  <th className="px-6 py-3 font-semibold">Date</th>
                  <th className="px-6 py-3 font-semibold">Branch</th>
                  <th className="px-6 py-3 font-semibold">Account</th>
                  <th className="px-6 py-3 font-semibold">Type</th>
                  <th className="px-6 py-3 font-semibold">Reference</th>
                  <th className="px-6 py-3 font-semibold">Description</th>
                  <th className="px-6 py-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                      No matching transaction entries found.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const isDebit = t.direction === "DEBIT";
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          {new Date(t.entryDate).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                          })}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap font-medium">
                          {t.branch}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          {t.accountName}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                            {t.type.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap font-mono text-xs text-slate-500">
                          {t.reference}
                        </td>
                        <td className="px-6 py-3.5 max-w-xs truncate text-slate-500">
                          {t.description || "-"}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-right font-semibold">
                          <span
                            className={`inline-flex items-center gap-1 ${
                              isDebit ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {isDebit ? "+" : "-"}
                            ETB {t.amount.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Add dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] max-w-3xl overflow-y-auto p-0">
          <div className="border-b border-border/70 px-4 py-4 sm:px-6">
            <DialogHeader>
              <DialogTitle>New Finance Account</DialogTitle>
              <DialogDescription>
                Create a global cash or bank account. Setting an initial balance posts an opening balance ledger entry.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-4 sm:p-6">
            <FinanceAccountForm
              options={options}
              // We pass a key callback or wrapper to close dialog on save success
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent className="max-h-[calc(100svh-2rem)] max-w-3xl overflow-y-auto p-0">
          <div className="border-b border-border/70 px-4 py-4 sm:px-6">
            <DialogHeader>
              <DialogTitle>Edit Finance Account</DialogTitle>
              <DialogDescription>
                Modify global cash or bank account details.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-4 sm:p-6">
            {editingAccount && (
              <FinanceAccountForm
                options={options}
                account={editingAccount}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
