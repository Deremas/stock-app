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
  { key: "movementDate", header: "Date", type: "dateTime" },
  { key: "product", header: "Item" },
  { key: "sku", header: "SKU", defaultHidden: true },
  { key: "unit", header: "Unit" },
  { key: "branch", header: "Shop", defaultHidden: true },
  { key: "movementType", header: "Transaction", type: "status" },
  { key: "ownershipType", header: "Ownership", defaultHidden: true },
  { key: "source", header: "Source / Reference" },
  { key: "received", header: "Qty In", type: "number" },
  { key: "issued", header: "Qty Out", type: "number" },
  { key: "balance", header: "Balance", type: "number" },
  { key: "unitCost", header: "Unit Cost", type: "currency", defaultHidden: true },
  { key: "unitValue", header: "Selling / Value", type: "currency", defaultHidden: true },
  { key: "counterparty", header: "Counterparty", defaultHidden: true },
];

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

export default async function BinCardReport({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const canViewAll = Boolean(
    user && hasPermission(user.role, "branch:view-all"),
  );
  const requestedBranchId = getSingleSearchParam(params, "branchId");
  const productId = getSingleSearchParam(params, "productId");
  const dateFrom = getSingleSearchParam(params, "dateFrom");
  const dateTo = getSingleSearchParam(params, "dateTo");
  const startDate = parseDate(dateFrom);
  const endDate = parseDate(dateTo, true);
  const branchId = canViewAll
    ? requestedBranchId || undefined
    : user?.activeBranchId || undefined;

  const [movements, products, branches] = await Promise.all([
    prisma.stockMovement.findMany({
      where: {
        product: { isActive: true },
        ...(branchId ? { branchId } : {}),
        ...(productId ? { productId } : {}),
        ...(endDate ? { movementDate: { lte: endDate } } : {}),
      },
      orderBy: [
        { product: { name: "asc" } },
        { branch: { name: "asc" } },
        { movementDate: "asc" },
        { createdAt: "asc" },
      ],
      include: {
        branch: { select: { name: true } },
        product: { select: { name: true, sku: true, unit: true } },
      },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sku: true },
      orderBy: { name: "asc" },
    }),
    canViewAll
      ? prisma.branch.findMany({
          where: { isActive: true },
          select: { id: true, code: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve(user?.branches ?? []),
  ]);

  const sourceIds = (sourceType: string) =>
    movements
      .filter((movement) => movement.sourceType === sourceType)
      .map((movement) => movement.sourceId);
  const [purchases, sales, intakes, assignments, returns, transfers, adjustments] =
    await Promise.all([
      prisma.purchase.findMany({
        where: { id: { in: sourceIds("Purchase") } },
        select: { id: true, purchaseNumber: true },
      }),
      prisma.sale.findMany({
        where: { id: { in: sourceIds("Sale") } },
        select: { id: true, saleNumber: true },
      }),
      prisma.sellerIntake.findMany({
        where: { id: { in: sourceIds("SellerIntake") } },
        select: { id: true, intakeNumber: true },
      }),
      prisma.sellerAssignment.findMany({
        where: { id: { in: sourceIds("SellerAssignment") } },
        select: { id: true, assignmentNumber: true },
      }),
      prisma.sellerReturn.findMany({
        where: { id: { in: sourceIds("SellerReturn") } },
        select: { id: true, returnNumber: true },
      }),
      prisma.transfer.findMany({
        where: { id: { in: sourceIds("Transfer") } },
        select: { id: true, transferNumber: true },
      }),
      prisma.inventoryAdjustment.findMany({
        where: { id: { in: sourceIds("InventoryAdjustment") } },
        select: { id: true, referenceNumber: true },
      }),
    ]);
  const sourceReferences = new Map<string, string>([
    ...purchases.map((row) => [row.id, row.purchaseNumber] as const),
    ...sales.map((row) => [row.id, row.saleNumber] as const),
    ...intakes.map((row) => [row.id, row.intakeNumber] as const),
    ...assignments.map((row) => [row.id, row.assignmentNumber] as const),
    ...returns.map((row) => [row.id, row.returnNumber] as const),
    ...transfers.map((row) => [row.id, row.transferNumber] as const),
    ...adjustments.map((row) => [row.id, row.referenceNumber] as const),
  ]);

  const balances = new Map<string, number>();
  const rows: SimpleRow[] = [];

  for (const movement of movements) {
    const balanceKey = `${movement.branchId}:${movement.productId}`;
    const balance = (balances.get(balanceKey) ?? 0) + movement.quantity;
    balances.set(balanceKey, balance);

    if (startDate && movement.movementDate < startDate) {
      continue;
    }

    rows.push({
      id: movement.id,
      movementDate: movement.movementDate.toISOString(),
      product: movement.product.name,
      sku: movement.product.sku,
      unit: movement.product.unit,
      branch: movement.branch.name,
      movementType: movement.movementType,
      ownershipType: movement.ownershipType,
      source: `${movement.sourceType} • ${sourceReferences.get(movement.sourceId) ?? movement.sourceId}`,
      received: movement.quantity > 0 ? movement.quantity : null,
      issued: movement.quantity < 0 ? Math.abs(movement.quantity) : null,
      balance,
      unitCost: movement.unitCost ? Number(movement.unitCost) : null,
      unitValue: movement.unitValue ? Number(movement.unitValue) : null,
      counterparty: movement.counterpartyType
        ? `${movement.counterpartyType} • ${movement.counterpartyId ?? "N/A"}`
        : null,
    });
  }

  const selectedProduct = products.find((product) => product.id === productId);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inventory"
        title="Item Bin Card"
        description="Chronological quantity-in, quantity-out, and running balance for each item. Filter by item and date for a printable stock ledger."
      />
      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Select name="productId" defaultValue={productId ?? ""}>
              <option value="">All active items</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} • {product.sku}
                </option>
              ))}
            </Select>
            <Select name="branchId" defaultValue={requestedBranchId ?? ""}>
              <option value="">All shops</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} - {branch.name}
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
            <Button type="submit">Generate bin card</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <DataTable
            columns={columns}
            data={rows}
            exportTitle={
              selectedProduct
                ? `Bin Card - ${selectedProduct.name}`
                : "Item Bin Card"
            }
            exportFileName={
              selectedProduct
                ? `bin-card-${selectedProduct.sku.toLowerCase()}`
                : "item-bin-card"
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
