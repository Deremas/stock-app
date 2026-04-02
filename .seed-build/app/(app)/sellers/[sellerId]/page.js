import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { DailyCheckTableCard } from "@/components/sales/daily-check-table-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getTablePageConfig } from "@/lib/page-data";
import { getSellerRows } from "@/lib/page-data-sellers";
import { prisma } from "@/lib/prisma";
import { getSingleSearchParam } from "@/lib/query-params";
import { formatCompactNumber, formatCurrency, formatDate, formatDateTime, } from "@/lib/utils";
function withFilter(path, params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value) {
            searchParams.set(key, value);
        }
    }
    const query = searchParams.toString();
    return query ? `${path}?${query}` : path;
}
function getNumericValue(row, key) {
    const value = row?.[key];
    const amount = typeof value === "number" ? value : Number(value ?? 0);
    return Number.isFinite(amount) ? amount : 0;
}
function sumColumn(rows, key) {
    return rows.reduce((sum, row) => sum + getNumericValue(row, key), 0);
}
function getScopeLabel(branchLabel, dateFrom, dateTo) {
    const formatScopeDate = (value) => {
        const parsedValue = new Date(value);
        return Number.isNaN(parsedValue.getTime()) ? value : formatDate(parsedValue);
    };
    const parts = [branchLabel];
    if (dateFrom && dateTo) {
        parts.push(`${formatScopeDate(dateFrom)} to ${formatScopeDate(dateTo)}`);
    }
    else if (dateFrom) {
        parts.push(`From ${formatScopeDate(dateFrom)}`);
    }
    else if (dateTo) {
        parts.push(`Until ${formatScopeDate(dateTo)}`);
    }
    else {
        parts.push("All dates");
    }
    return parts.join(" | ");
}
export default async function Page({ params, searchParams, }) {
    const [{ sellerId }, query] = await Promise.all([params, searchParams]);
    const branchId = getSingleSearchParam(query, "branchId");
    const dateFrom = getSingleSearchParam(query, "dateFrom");
    const dateTo = getSingleSearchParam(query, "dateTo");
    const user = await getCurrentUser();
    const activeBranchId = branchId ?? user?.activeBranchId;
    const activeBranch = user?.branches.find((branch) => branch.id === activeBranchId) ?? user?.branches[0];
    const scopeParams = {
        ...(activeBranchId ? { branchId: activeBranchId } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
    };
    const [seller, sellerRows, intakeConfig, assignedConfig, returnConfig, settlementConfig, collectionConfig, soldItemsConfig,] = await Promise.all([
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
    const metrics = [
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
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(PageHeader, { title: seller.fullName, description: "Single-partner workspace for current exposure, full operating history, and the next receive, return, pay, and collect actions." }), _jsxs("div", { className: "grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]", children: [_jsxs(Card, { children: [_jsx(CardHeader, { className: "gap-3", children: _jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsx(CardTitle, { className: "text-2xl", children: seller.fullName }), _jsx(CardDescription, { children: scopeLabel })] }), _jsx(Badge, { variant: seller.isActive ? "success" : "outline", children: seller.isActive ? "Active" : "Inactive" })] }) }), _jsxs(CardContent, { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.18em] text-muted-foreground", children: "Phone" }), _jsx("p", { className: "text-sm", children: seller.phone ?? "-" })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.18em] text-muted-foreground", children: "Last Intake" }), _jsx("p", { className: "text-sm", children: sellerRow?.lastIntakeAt ? formatDateTime(String(sellerRow.lastIntakeAt)) : "-" })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.18em] text-muted-foreground", children: "Location" }), _jsx("p", { className: "text-sm", children: seller.address ?? "-" })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.18em] text-muted-foreground", children: "Partner Since" }), _jsx("p", { className: "text-sm", children: formatDate(seller.createdAt) })] }), _jsxs("div", { className: "space-y-1 sm:col-span-2", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.18em] text-muted-foreground", children: "Note" }), _jsx("p", { className: "text-sm text-muted-foreground", children: seller.note ?? "-" })] })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Quick Actions" }), _jsx(CardDescription, { children: "Open the existing partner workflows with this partner preselected." })] }), _jsxs(CardContent, { className: "flex flex-wrap gap-3", children: [_jsx(Button, { asChild: true, size: "sm", children: _jsx("a", { href: receiveHref, children: "Receive items" }) }), _jsx(Button, { asChild: true, size: "sm", variant: "outline", children: _jsx("a", { href: assignHref, children: "Assign items" }) }), _jsx(Button, { asChild: true, size: "sm", variant: "outline", children: _jsx("a", { href: returnHref, children: "Record return" }) }), _jsx(Button, { asChild: true, size: "sm", variant: "outline", children: _jsx("a", { href: settlementHref, children: "Pay partner" }) }), _jsx(Button, { asChild: true, size: "sm", variant: "outline", children: _jsx("a", { href: collectionHref, children: "Collect birr" }) }), _jsx(Button, { asChild: true, size: "sm", variant: "outline", children: _jsx("a", { href: soldItemsHref, children: "View sold items" }) })] })] })] }), _jsx(MetricGrid, { metrics: metrics, mobileColumns: 2 }), _jsxs("div", { className: "grid gap-6 xl:grid-cols-2", children: [_jsx(DailyCheckTableCard, { title: intakeConfig.title, description: "Everything this partner brought in, including what remains in branch stock.", columns: intakeConfig.columns, rows: intakeConfig.rows, exportFileName: `partner-${sellerId}-received-records`, emptyStateMessage: "No received records found for this partner in the selected scope." }), _jsx(DailyCheckTableCard, { title: assignedConfig.title, description: "Items issued from branch stock to this partner, with sold and still-out quantities.", columns: assignedConfig.columns, rows: assignedConfig.rows, exportFileName: `partner-${sellerId}-assigned-items`, emptyStateMessage: "No assigned-item records found for this partner in the selected scope." }), _jsx(DailyCheckTableCard, { title: soldItemsConfig.title, description: "Sold item lines linked to this partner from both received and assigned flows.", columns: soldItemsConfig.columns, rows: soldItemsConfig.rows, exportFileName: `partner-${sellerId}-sold-items`, emptyStateMessage: "No sold-item lines found for this partner in the selected scope." }), _jsx(DailyCheckTableCard, { title: returnConfig.title, description: "Posted returns back to the partner or back into branch stock.", columns: returnConfig.columns, rows: returnConfig.rows, exportFileName: `partner-${sellerId}-returns`, emptyStateMessage: "No posted returns found for this partner in the selected scope." }), _jsx(DailyCheckTableCard, { title: settlementConfig.title, description: "Birr paid out for sold received-partner stock with account traceability.", columns: settlementConfig.columns, rows: settlementConfig.rows, exportFileName: `partner-${sellerId}-payments`, emptyStateMessage: "No partner payments found for this partner in the selected scope." }), _jsx(DailyCheckTableCard, { title: collectionConfig.title, description: "Birr collected for sold assigned-from-us items.", columns: collectionConfig.columns, rows: collectionConfig.rows, exportFileName: `partner-${sellerId}-collections`, emptyStateMessage: "No partner collections found for this partner in the selected scope." })] })] }));
}
