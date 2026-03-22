import { notFound } from "next/navigation";

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
import { getSellerRows } from "@/lib/page-data-sellers";
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
    sellerRows,
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
      },
    }),
    getSellerRows(activeBranchId),
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

  const sellerRow = sellerRows.find((row) => row.id === sellerId);
  const receivedOnHandQty = getNumericValue(sellerRow, "receivedOnHandQty");
  const assignedOutQty = getNumericValue(sellerRow, "assignedOutQty");
  const payableAmount = getNumericValue(sellerRow, "payableAmount");
  const receivableAmount = getNumericValue(sellerRow, "receivableAmount");
  const totalSoldQty = sumColumn(soldItemsConfig.rows, "quantity");
  const totalReturnedQty = sumColumn(returnConfig.rows, "quantity");
  const totalPaidAmount = sumColumn(settlementConfig.rows, "amount");
  const totalCollectedAmount = sumColumn(collectionConfig.rows, "amount");
  const branchLabel = activeBranch
    ? `${activeBranch.code} - ${activeBranch.name}`
    : activeBranchId
      ? "Selected branch"
      : "All branches";
  const scopeLabel = getScopeLabel(branchLabel, dateFrom, dateTo);

  const metrics: MetricCard[] = [
    {
      title: "Received On Hand",
      value: formatCompactNumber(receivedOnHandQty),
      tone: receivedOnHandQty > 0 ? "warning" : "default",
      meta: "Partner-owned stock still in branch",
    },
    {
      title: "Assigned Out",
      value: formatCompactNumber(assignedOutQty),
      tone: assignedOutQty > 0 ? "warning" : "default",
      meta: "Branch-owned stock still with partner",
    },
    {
      title: "Received Payable",
      value: formatCurrency(payableAmount),
      tone: payableAmount > 0 ? "danger" : "default",
      meta: "Birr still owed for sold received stock",
    },
    {
      title: "Assigned Receivable",
      value: formatCurrency(receivableAmount),
      tone: receivableAmount > 0 ? "success" : "default",
      meta: "Birr still to collect for sold assigned stock",
    },
    {
      title: "Total Paid",
      value: formatCurrency(totalPaidAmount),
      tone: totalPaidAmount > 0 ? "default" : "warning",
      meta: `${settlementConfig.rows.length} payment records posted`,
    },
    {
      title: "Total Collected",
      value: formatCurrency(totalCollectedAmount),
      tone: totalCollectedAmount > 0 ? "success" : "warning",
      meta: `${collectionConfig.rows.length} collection records posted`,
    },
    {
      title: "Total Returned",
      value: formatCompactNumber(totalReturnedQty),
      tone: totalReturnedQty > 0 ? "warning" : "default",
      meta: `${returnConfig.rows.length} return records posted`,
    },
    {
      title: "Total Sold",
      value: formatCompactNumber(totalSoldQty),
      tone: totalSoldQty > 0 ? "default" : "warning",
      meta: `${soldItemsConfig.rows.length} sold item lines linked`,
    },
  ];

  const receiveHref = withFilter("/sellers/intake-records", {
    sellerId,
    open: "1",
    ...scopeParams,
  });
  const assignHref = withFilter("/sellers/assign-items", {
    sellerId,
    open: "1",
    ...(activeBranchId ? { branchId: activeBranchId } : {}),
  });
  const returnHref = withFilter("/sellers/returns", {
    sellerId,
    open: "1",
    ...scopeParams,
  });
  const settlementHref = withFilter("/sellers/settlements", {
    sellerId,
    open: "1",
    ...scopeParams,
  });
  const collectionHref = withFilter("/sellers/collections", {
    sellerId,
    open: "1",
    ...scopeParams,
  });
  const soldItemsHref = withFilter("/sales/sold-items", {
    sellerId,
    ...scopeParams,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={seller.fullName}
        description="Single-partner workspace for current exposure, full operating history, and the next receive, return, pay, and collect actions."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-2xl">{seller.fullName}</CardTitle>
                <CardDescription>{scopeLabel}</CardDescription>
              </div>
              <Badge variant={seller.isActive ? "success" : "outline"}>
                {seller.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Phone
              </p>
              <p className="text-sm">{seller.phone ?? "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Last Intake
              </p>
              <p className="text-sm">
                {sellerRow?.lastIntakeAt ? formatDateTime(String(sellerRow.lastIntakeAt)) : "-"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Location
              </p>
              <p className="text-sm">{seller.address ?? "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Partner Since
              </p>
              <p className="text-sm">{formatDate(seller.createdAt)}</p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Note
              </p>
              <p className="text-sm text-muted-foreground">{seller.note ?? "-"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Open the existing partner workflows with this partner preselected.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild size="sm">
              <a href={receiveHref}>Receive items</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={assignHref}>Assign items</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={returnHref}>Record return</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={settlementHref}>Pay partner</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={collectionHref}>Collect birr</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={soldItemsHref}>View sold items</a>
            </Button>
          </CardContent>
        </Card>
      </div>
      <MetricGrid metrics={metrics} mobileColumns={2} />
      <div className="grid gap-6 xl:grid-cols-2">
        <DailyCheckTableCard
          title={intakeConfig.title}
          description="Everything this partner brought in, including what remains in branch stock."
          columns={intakeConfig.columns}
          rows={intakeConfig.rows}
          exportFileName={`partner-${sellerId}-received-records`}
          emptyStateMessage="No received records found for this partner in the selected scope."
        />
        <DailyCheckTableCard
          title={assignedConfig.title}
          description="Items issued from branch stock to this partner, with sold and still-out quantities."
          columns={assignedConfig.columns}
          rows={assignedConfig.rows}
          exportFileName={`partner-${sellerId}-assigned-items`}
          emptyStateMessage="No assigned-item records found for this partner in the selected scope."
        />
        <DailyCheckTableCard
          title={soldItemsConfig.title}
          description="Sold item lines linked to this partner from both received and assigned flows."
          columns={soldItemsConfig.columns}
          rows={soldItemsConfig.rows}
          exportFileName={`partner-${sellerId}-sold-items`}
          emptyStateMessage="No sold-item lines found for this partner in the selected scope."
        />
        <DailyCheckTableCard
          title={returnConfig.title}
          description="Posted returns back to the partner or back into branch stock."
          columns={returnConfig.columns}
          rows={returnConfig.rows}
          exportFileName={`partner-${sellerId}-returns`}
          emptyStateMessage="No posted returns found for this partner in the selected scope."
        />
        <DailyCheckTableCard
          title={settlementConfig.title}
          description="Birr paid out for sold received-partner stock with account traceability."
          columns={settlementConfig.columns}
          rows={settlementConfig.rows}
          exportFileName={`partner-${sellerId}-payments`}
          emptyStateMessage="No partner payments found for this partner in the selected scope."
        />
        <DailyCheckTableCard
          title={collectionConfig.title}
          description="Birr collected for sold assigned-from-us items."
          columns={collectionConfig.columns}
          rows={collectionConfig.rows}
          exportFileName={`partner-${sellerId}-collections`}
          emptyStateMessage="No partner collections found for this partner in the selected scope."
        />
      </div>
    </div>
  );
}
