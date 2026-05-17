import { notFound } from "next/navigation";
import {
  Banknote,
  CalendarDays,
  HandCoins,
  MapPin,
  PackageMinus,
  PackagePlus,
  Phone,
  RotateCcw,
  ShoppingBag,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { DailyCheckTableCard } from "@/components/sales/daily-check-table-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getTablePageConfig } from "@/lib/page-data";
import { getSellerSummary } from "@/lib/page-data-sellers";
import { SellerWorkspaceTabs } from "@/components/sellers/seller-workspace-tabs";
import { prisma } from "@/lib/prisma";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";
import type { SimpleRow } from "@/lib/table";
import type { MetricCard } from "@/lib/types";
import {
  formatCompactNumber,
  formatCurrency,
  formatDate,
  formatDateTime,
} from "@/lib/utils";

type SellerOverviewPageProps = {
  params: Promise<{
    sellerId: string;
  }>;
  searchParams?: Promise<RouteSearchParams>;
};

function withFilter(path: string, params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

function getNumericValue(row: SimpleRow | undefined, key: string) {
  const value = row?.[key];
  const amount = typeof value === "number" ? value : Number(value ?? 0);

  return Number.isFinite(amount) ? amount : 0;
}

function sumColumn(rows: SimpleRow[], key: string) {
  return rows.reduce((sum, row) => sum + getNumericValue(row, key), 0);
}

function getScopeLabel(
  branchLabel: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const formatScopeDate = (value: string) => {
    const parsedValue = new Date(value);

    return Number.isNaN(parsedValue.getTime()) ? value : formatDate(parsedValue);
  };

  const parts = [branchLabel];

  if (dateFrom && dateTo) {
    parts.push(`${formatScopeDate(dateFrom)} to ${formatScopeDate(dateTo)}`);
  } else if (dateFrom) {
    parts.push(`From ${formatScopeDate(dateFrom)}`);
  } else if (dateTo) {
    parts.push(`Until ${formatScopeDate(dateTo)}`);
  } else {
    parts.push("All dates");
  }

  return parts.join(" | ");
}

export default async function Page({
  params,
  searchParams,
}: SellerOverviewPageProps) {
  const [{ sellerId }, query] = await Promise.all([params, searchParams]);
  const branchId = getSingleSearchParam(query, "branchId");
  const dateFrom = getSingleSearchParam(query, "dateFrom");
  const dateTo = getSingleSearchParam(query, "dateTo");
  const user = await getCurrentUser();
  const activeBranchId = branchId ?? user?.activeBranchId;
  const activeBranch =
    user?.branches.find((branch) => branch.id === activeBranchId) ?? user?.branches[0];

  const scopeParams = {
    ...(activeBranchId ? { branchId: activeBranchId } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  };

  const [
    seller,
    metricsData,
    intakeConfig,
    assignedConfig,
    returnConfig,
    settlementConfig,
    collectionConfig,
    soldItemsConfig,
  ] = await Promise.all([
    prisma.seller.findUnique({
      where: {
        id: sellerId,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        address: true,
        note: true,
        isActive: true,
        createdAt: true,
        intakes: {
          where: {
            ...(activeBranchId ? { branchId: activeBranchId } : {}),
          },
          select: {
            bringingDate: true,
          },
          orderBy: {
            bringingDate: "desc",
          },
          take: 1,
        },
      },
    }),
    getSellerSummary(sellerId, activeBranchId),
    getTablePageConfig("sellersIntakeRecords", {
      sellerId,
      ...scopeParams,
    }),
    getTablePageConfig("sellersAssignedItems", {
      sellerId,
      ...(activeBranchId ? { branchId: activeBranchId } : {}),
    }),
    getTablePageConfig("sellersReturns", {
      sellerId,
      ...scopeParams,
    }),
    getTablePageConfig("sellersSettlements", {
      sellerId,
      ...scopeParams,
    }),
    getTablePageConfig("sellersCollections", {
      sellerId,
      ...scopeParams,
    }),
    getTablePageConfig("salesSoldItems", {
      sellerId,
      ...scopeParams,
    }),
  ]);

  if (!seller) {
    notFound();
  }

  const { receivedOnHand, assignedOut, payable, receivable } = metricsData;
  const lastIntakeAt = seller.intakes[0]?.bringingDate;
  const branchLabel = activeBranch
    ? `${activeBranch.code} - ${activeBranch.name}`
    : activeBranchId
      ? "Selected branch"
      : "All branches";
  const scopeLabel = getScopeLabel(branchLabel, dateFrom, dateTo);

  const metrics: MetricCard[] = [
    {
      title: "Received On Hand",
      value: formatCompactNumber(receivedOnHand),
      tone: receivedOnHand > 0 ? "warning" : "default",
      meta: "Partner-owned stock",
    },
    {
      title: "Assigned Out",
      value: formatCompactNumber(assignedOut),
      tone: assignedOut > 0 ? "warning" : "default",
      meta: "Branch-owned stock out",
    },
    {
      title: "Received Payable",
      value: formatCurrency(payable),
      tone: payable > 0 ? "danger" : "default",
      meta: "Owed for sold stock",
    },
    {
      title: "Assigned Receivable",
      value: formatCurrency(receivable),
      tone: receivable > 0 ? "success" : "default",
      meta: "To collect from partner",
    },
  ];

  const hrefs = {
    receive: withFilter("/sellers/intake-records", { sellerId, open: "1", ...scopeParams }),
    assign: withFilter("/sellers/assign-items", { sellerId, open: "1", ...(activeBranchId ? { branchId: activeBranchId } : {}) }),
    return: withFilter("/sellers/returns", { sellerId, open: "1", ...scopeParams }),
    settlement: withFilter("/sellers/settlements", { sellerId, open: "1", ...scopeParams }),
    collection: withFilter("/sellers/collections", { sellerId, open: "1", ...scopeParams }),
    soldItems: withFilter("/sales/sold-items", { sellerId, ...scopeParams }),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{seller.fullName}</h1>
              <Badge variant={seller.isActive ? "success" : "outline"} className="rounded-lg px-2 py-0.5 text-[10px]">
                {seller.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-xs font-medium text-muted-foreground">{scopeLabel}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl bg-primary/5 px-5 py-3 ring-1 ring-primary/10">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
              <Phone className="h-3.5 w-3.5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">Phone</p>
              <p className="text-xs font-semibold">{seller.phone ?? "-"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
              <MapPin className="h-3.5 w-3.5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">Location</p>
              <p className="text-xs font-semibold">{seller.address ?? "-"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
              <CalendarDays className="h-3.5 w-3.5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">Last Intake</p>
              <p className="text-xs font-semibold">
                {lastIntakeAt ? formatDateTime(lastIntakeAt.toISOString()) : "-"}
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2.5 sm:flex">
            <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
              <Users className="h-3.5 w-3.5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">Partner Since</p>
              <p className="text-xs font-semibold">{formatDate(seller.createdAt)}</p>
            </div>
          </div>
        </div>
      </div>

      <MetricGrid metrics={metrics} mobileColumns={2} />

      <SellerWorkspaceTabs
        sellerId={sellerId}
        intakeConfig={intakeConfig}
        assignedConfig={assignedConfig}
        returnConfig={returnConfig}
        settlementConfig={settlementConfig}
        collectionConfig={collectionConfig}
        soldItemsConfig={soldItemsConfig}
        hrefs={hrefs}
        balances={{
          payable: payable,
          receivable: receivable
        }}
      />
    </div>
  );
}
