import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/data-runtime-utils";
import { DiscountsClient } from "./discounts-client";

type RouteSearchParams = {
  branchId?: string | string[];
  dateFrom?: string | string[];
  dateTo?: string | string[];
  q?: string | string[];
};

type PageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const canViewAll = user && hasPermission(user.role, "branch:view-all");
  const activeBranchId = canViewAll ? undefined : user?.activeBranchId;

  // 1. Fetch available branches
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // 2. Parse search filter parameters
  const branchId = params?.branchId ? String(params.branchId) : undefined;
  const dateFrom = params?.dateFrom ? String(params.dateFrom) : undefined;
  const dateTo = params?.dateTo ? String(params.dateTo) : undefined;
  const q = params?.q ? String(params.q).trim() : "";

  const startOfRange = dateFrom ? new Date(dateFrom) : undefined;
  const endOfRange = dateTo ? new Date(dateTo) : undefined;
  if (endOfRange) {
    endOfRange.setHours(23, 59, 59, 999);
  }

  const resolvedBranchId =
    activeBranchId ??
    (branchId && branchId !== "all" ? branchId : undefined);

  // 3. Query all discounted completed sales items
  const dbItems = await prisma.saleItem.findMany({
    where: {
      sale: {
        status: "COMPLETED",
        ...(resolvedBranchId ? { branchId: resolvedBranchId } : {}),
        ...(startOfRange || endOfRange
          ? {
              soldAt: {
                ...(startOfRange ? { gte: startOfRange } : {}),
                ...(endOfRange ? { lte: endOfRange } : {}),
              },
            }
          : {}),
      },
      ...(q
        ? {
            product: {
              name: { contains: q, mode: "insensitive" },
            },
          }
        : {}),
      OR: [
        { discount: { gt: 0 } },
        { fixedDiscount: { gt: 0 } },
      ],
    },
    include: {
      product: { select: { name: true } },
      sale: {
        select: {
          saleNumber: true,
          soldAt: true,
          branch: { select: { name: true } },
          customer: { select: { name: true } },
        },
      },
    },
    orderBy: { sale: { soldAt: "desc" } },
  });

  // 4. Map DB records to Client Component structures
  const items = dbItems.map((item) => {
    const qty = item.quantity;
    const discPerUnit = toNumber(item.discount);
    const fixedDisc = toNumber(item.fixedDiscount);
    const totalDiscount = discPerUnit * qty + fixedDisc;

    return {
      id: item.id,
      soldAt: item.sale.soldAt.toISOString(),
      saleNumber: item.sale.saleNumber,
      branch: item.sale.branch.name,
      product: item.product.name,
      customer: item.sale.customer?.name ?? "Walk-in",
      quantity: qty,
      unitPrice: toNumber(item.unitPrice),
      discountPerUnit: discPerUnit,
      fixedDiscount: fixedDisc,
      totalDiscount,
      lineTotal: toNumber(item.lineTotal),
    };
  });

  // 5. Calculate metrics
  let totalDiscountValue = 0;
  let totalUndiscountedRevenue = 0;
  const productDiscounts = new Map<string, number>();

  items.forEach((item) => {
    totalDiscountValue += item.totalDiscount;
    // Undiscounted retail price would be quantity * retail unitPrice
    totalUndiscountedRevenue += item.unitPrice * item.quantity;

    const currentProdDisc = productDiscounts.get(item.product) || 0;
    productDiscounts.set(item.product, currentProdDisc + item.totalDiscount);
  });

  const averageRate = totalUndiscountedRevenue > 0
    ? (totalDiscountValue / totalUndiscountedRevenue) * 100
    : 0;

  // Find most discounted product
  let mostDiscountedProduct = "";
  let mostDiscountedAmount = 0;

  productDiscounts.forEach((amount, product) => {
    if (amount > mostDiscountedAmount) {
      mostDiscountedAmount = amount;
      mostDiscountedProduct = product;
    }
  });

  const kpis = {
    totalDiscount: totalDiscountValue,
    averageRate,
    mostDiscountedProduct,
    mostDiscountedAmount,
  };

  return (
    <DiscountsClient
      items={items}
      branches={branches}
      kpis={kpis}
    />
  );
}
