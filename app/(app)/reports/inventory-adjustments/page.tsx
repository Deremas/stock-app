import { PageHeader } from "@/components/app-shell/page-header";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";
import { hasPermission } from "@/lib/rbac";
import type { SimpleColumn, SimpleRow } from "@/lib/table";

type PageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

const columns: SimpleColumn[] = [
  { key: "createdAt", header: "Adjusted At", type: "dateTime" },
  { key: "branch", header: "Branch" },
  { key: "product", header: "Product" },
  { key: "referenceNumber", header: "Batch" },
  { key: "batchType", header: "Source", type: "status" },
  { key: "adjustmentType", header: "Adjustment", type: "status" },
  { key: "previousPrice", header: "Previous Price", type: "currency" },
  { key: "newPrice", header: "New Price", type: "currency" },
  { key: "previousQuantity", header: "Previous Qty", type: "number" },
  { key: "newQuantity", header: "New Qty", type: "number" },
  { key: "quantityDelta", header: "Qty Change", type: "number" },
  { key: "reason", header: "Reason", type: "multiline" },
  { key: "actor", header: "Adjusted By" },
];

export default async function InventoryAdjustmentsReport({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const canViewAll = Boolean(
    user && hasPermission(user.role, "branch:view-all"),
  );
  const requestedBranchId = getSingleSearchParam(params, "branchId");
  const dateFrom = getSingleSearchParam(params, "dateFrom");
  const dateTo = getSingleSearchParam(params, "dateTo");
  const query = getSingleSearchParam(params, "q")?.trim() ?? "";
  const branchId = canViewAll
    ? requestedBranchId || undefined
    : user?.activeBranchId || undefined;

  const startDate = dateFrom ? new Date(dateFrom) : undefined;
  const endDate = dateTo ? new Date(dateTo) : undefined;
  endDate?.setHours(23, 59, 59, 999);

  const [adjustments, branches] = await Promise.all([
    prisma.inventoryAdjustment.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
        ...(query
          ? {
              OR: [
                {
                  product: {
                    name: { contains: query, mode: "insensitive" },
                  },
                },
                {
                  referenceNumber: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                { reason: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { name: true } },
        branch: { select: { name: true } },
        actor: { select: { name: true, username: true } },
      },
    }),
    canViewAll
      ? prisma.branch.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve(user?.branches ?? []),
  ]);

  const rows: SimpleRow[] = adjustments.map((adjustment) => {
    const isQuantity = adjustment.adjustmentType === "QUANTITY";

    return {
      id: adjustment.id,
      createdAt: adjustment.createdAt.toISOString(),
      branch: adjustment.branch.name,
      product: adjustment.product.name,
      referenceNumber: adjustment.referenceNumber,
      batchType: adjustment.batchType,
      adjustmentType: adjustment.adjustmentType,
      previousPrice: isQuantity ? null : Number(adjustment.previousValue),
      newPrice: isQuantity ? null : Number(adjustment.newValue),
      previousQuantity: isQuantity ? Number(adjustment.previousValue) : null,
      newQuantity: isQuantity ? Number(adjustment.newValue) : null,
      quantityDelta: adjustment.quantityDelta,
      reason: adjustment.reason,
      actor: adjustment.actor.name || adjustment.actor.username,
    };
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reports"
        title="Inventory Adjustments"
        description="Audited buying-price, selling-price, and quantity changes. Completed sale history remains unchanged."
      />
      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Select name="branchId" defaultValue={requestedBranchId ?? ""}>
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <Input
              name="dateFrom"
              type="date"
              defaultValue={dateFrom ?? ""}
              aria-label="Date from"
            />
            <Input
              name="dateTo"
              type="date"
              defaultValue={dateTo ?? ""}
              aria-label="Date to"
            />
            <Input
              name="q"
              defaultValue={query}
              placeholder="Product, batch, or reason"
              aria-label="Search adjustments"
            />
            <Button type="submit">Apply filters</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <DataTable
            columns={columns}
            data={rows}
            exportTitle="Inventory Adjustments"
            exportFileName="inventory-adjustments"
          />
        </CardContent>
      </Card>
    </div>
  );
}
