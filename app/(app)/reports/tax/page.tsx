import { TablePage } from "@/components/tables/table-page";
import { getCurrentUser } from "@/lib/auth/session";
import { toNumber } from "@/lib/data-runtime-utils";
import { prisma } from "@/lib/prisma";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";
import { hasPermission } from "@/lib/rbac";
import type { TablePageConfig } from "@/lib/table";

type TaxReportPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function TaxReportPage({ searchParams }: TaxReportPageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const canViewAll = Boolean(user && hasPermission(user.role, "branch:view-all"));
  const requestedBranchId = getSingleSearchParam(params, "branchId");
  const branchId = canViewAll ? requestedBranchId : user?.activeBranchId;
  const dateFrom = getSingleSearchParam(params, "dateFrom");
  const dateTo = getSingleSearchParam(params, "dateTo");
  const start = dateFrom ? new Date(dateFrom) : undefined;
  const end = dateTo ? new Date(dateTo) : undefined;
  end?.setHours(23, 59, 59, 999);
  const dateFilter = start || end
    ? { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) }
    : undefined;

  const [sales, purchases] = await Promise.all([
    prisma.sale.findMany({
      where: {
        taxAmount: { gt: 0 },
        status: { not: "VOIDED" },
        ...(branchId ? { branchId } : {}),
        ...(dateFilter ? { soldAt: dateFilter } : {}),
      },
      select: {
        id: true,
        saleNumber: true,
        soldAt: true,
        taxTreatment: true,
        taxRate: true,
        taxableAmount: true,
        taxAmount: true,
        total: true,
        branch: { select: { name: true } },
        customer: { select: { name: true } },
      },
      orderBy: { soldAt: "desc" },
    }),
    prisma.purchase.findMany({
      where: {
        tax: { gt: 0 },
        status: { not: "CANCELLED" },
        ...(branchId ? { branchId } : {}),
        ...(dateFilter ? { purchasedAt: dateFilter } : {}),
      },
      select: {
        id: true,
        purchaseNumber: true,
        purchasedAt: true,
        taxTreatment: true,
        taxRate: true,
        taxableAmount: true,
        tax: true,
        total: true,
        vatTreatment: true,
        branch: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { purchasedAt: "desc" },
    }),
  ]);

  const outputVat = sales.reduce((sum, row) => sum + toNumber(row.taxAmount), 0);
  const recoverableInputVat = purchases.reduce(
    (sum, row) => sum + (row.vatTreatment === "RECOVERABLE" ? toNumber(row.tax) : 0),
    0,
  );
  const rows = [
    ...sales.map((row) => ({
      id: `sale-${row.id}`,
      date: row.soldAt.toISOString(),
      type: "OUTPUT VAT",
      reference: row.saleNumber,
      branch: row.branch.name,
      counterparty: row.customer?.name ?? "Walk-in",
      treatment: row.taxTreatment,
      rate: `${toNumber(row.taxRate)}%`,
      taxableAmount: toNumber(row.taxableAmount),
      taxAmount: toNumber(row.taxAmount),
      total: toNumber(row.total),
    })),
    ...purchases.map((row) => ({
      id: `purchase-${row.id}`,
      date: row.purchasedAt.toISOString(),
      type: row.vatTreatment === "RECOVERABLE" ? "INPUT VAT" : "NON-RECOVERABLE",
      reference: row.purchaseNumber,
      branch: row.branch.name,
      counterparty: row.supplier?.name ?? "Direct purchase",
      treatment: row.taxTreatment,
      rate: `${toNumber(row.taxRate)}%`,
      taxableAmount: toNumber(row.taxableAmount),
      taxAmount: toNumber(row.tax),
      total: toNumber(row.total),
    })),
  ].sort((left, right) => right.date.localeCompare(left.date));

  const config: TablePageConfig = {
    eyebrow: "Reports",
    title: "VAT report",
    description: "Historical output and input VAT based on the values saved on each posted document.",
    exportFileName: "vat-report",
    kpis: [
      { title: "Output VAT", value: `ETB ${outputVat.toLocaleString()}` },
      { title: "Recoverable Input VAT", value: `ETB ${recoverableInputVat.toLocaleString()}` },
      {
        title: "Net VAT Position",
        value: `ETB ${(outputVat - recoverableInputVat).toLocaleString()}`,
        tone: outputVat - recoverableInputVat > 0 ? "warning" : "success",
      },
    ],
    columns: [
      { key: "date", header: "Date", type: "dateTime" },
      { key: "type", header: "Type", type: "status" },
      { key: "reference", header: "Reference" },
      { key: "branch", header: "Branch" },
      { key: "counterparty", header: "Customer / Supplier" },
      { key: "treatment", header: "Treatment", type: "status" },
      { key: "rate", header: "Rate" },
      { key: "taxableAmount", header: "Taxable", type: "currency" },
      { key: "taxAmount", header: "VAT", type: "currency" },
      { key: "total", header: "Total", type: "currency" },
    ],
    rows,
  };

  return <TablePage config={config} />;
}
