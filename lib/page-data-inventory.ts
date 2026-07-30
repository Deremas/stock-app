import { prisma } from "@/lib/prisma";
import { getOwnedStockBatches } from "@/lib/owned-stock-batches";
import type { RowActionConfig, SimpleRow } from "@/lib/table";
import { sumRows } from "@/lib/data-runtime-utils";
import { getStockSummaryRows } from "@/lib/stock-runtime-data";
import { formatCurrency, formatDateTime, toTitleCase } from "@/lib/utils";
import type { AppRole } from "@/lib/rbac";

function createRowAction(action: RowActionConfig) {
  return action;
}

function createQuickSellHref(input: {
  productId: string;
  branchId?: string;
}) {
  const params = new URLSearchParams({
    productId: input.productId,
  });

  if (input.branchId) {
    params.set("branchId", input.branchId);
  }

  return `/sales/new?${params.toString()}`;
}

function createQuickPurchaseHref(input: {
  productId: string;
  branchId?: string;
}) {
  const params = new URLSearchParams({
    productId: input.productId,
    open: "1",
  });

  if (input.branchId) {
    params.set("branchId", input.branchId);
  }

  return `/purchases/list?${params.toString()}`;
}

function createBatchListHref(input: { productId: string; branchId: string }) {
  const params = new URLSearchParams({
    productId: input.productId,
    branchId: input.branchId,
    openBatches: "1",
  });

  return `/inventory/stock?${params.toString()}`;
}

function createEditItemHref(productId: string) {
  const params = new URLSearchParams({
    productId,
    mode: "edit",
    open: "1",
  });

  return `/inventory/products?${params.toString()}`;
}

export async function getProductRows(branchId?: string) {
  const [products, stockSummary] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        minimumStockAlert: true,
        isActive: true,
      },
    }),
    getStockSummaryRows(branchId),
  ]);

  const stockByProduct = new Map<string, number>();

  for (const row of stockSummary) {
    stockByProduct.set(row.productId, (stockByProduct.get(row.productId) ?? 0) + row.totalQty);
  }

  return products.map(
    (product) =>
      ({
        id: product.id,
        name: product.name,
        minimumStockAlert: product.minimumStockAlert,
        currentStock: stockByProduct.get(product.id) ?? 0,
        status: product.isActive ? "ACTIVE" : "INACTIVE",
        __actions: [
          createRowAction({
            key: "edit",
            label: "Edit",
            href: createEditItemHref(product.id),
            icon: "edit",
          }),
        ],
      }) satisfies SimpleRow,
  );
}

export async function getStockOverviewRows(branchId?: string, role: AppRole = "SALES") {
  const [rows, ownedBatches] = await Promise.all([
    getStockSummaryRows(branchId),
    getOwnedStockBatches(branchId ? { branchId } : {}),
  ]);

  const ownedBatchMap = new Map<
    string,
    {
      count: number;
      lines: string[];
    }
  >();

  for (const batch of ownedBatches) {
    const key = `${batch.branchId}:${batch.productId}`;
    const existing = ownedBatchMap.get(key);
    const batchLine = `${
      batch.sourceType === "PURCHASE" ? batch.referenceNumber : `${batch.referenceNumber} from ${batch.sourceName}`
    } | ${batch.remainingQuantity} qty | Buy ${formatCurrency(batch.unitCost)} | Sell ${formatCurrency(batch.sellingPrice)}`;

    if (!existing) {
      ownedBatchMap.set(key, {
        count: 1,
        lines: [batchLine],
      });
      continue;
    }

    existing.count += 1;
    existing.lines.push(batchLine);
  }

  return rows.map(
    (row) => {
      const batchSummary = ownedBatchMap.get(`${row.branchId}:${row.productId}`);
      const actions: RowActionConfig[] = [];
      const daysOld = Math.floor((Date.now() - row.lastMovementDate.getTime()) / (1000 * 60 * 60 * 24));
      const agingText = daysOld === 0 ? "Today" : `${daysOld} day${daysOld === 1 ? "" : "s"} ago`;
      const isDeadStock = daysOld > 90;

      actions.push(
        createRowAction({
          key: "view_movements",
          label: "View Movements",
          href: `/inventory/stock-movements?productId=${row.productId}${row.branchId ? `&branchId=${row.branchId}` : ''}`,
          icon: "view",
          showLabel: true,
        })
      );

      if (row.ownedQty > 0) {
        actions.push(
          createRowAction({
            key: "batches",
            label: "Batches",
            href: createBatchListHref({
              productId: row.productId,
              branchId: row.branchId,
            }),
            icon: "stockOverview",
            showLabel: true,
          }),
        );
      }

      if (row.totalQty > 0) {
        actions.push(
          createRowAction({
            key: "transfer",
            label: "Transfer",
            href: `/inventory/transfers?open=1&productId=${row.productId}&fromBranchId=${row.branchId}`,
            icon: "transfer",
            showLabel: true,
          }),
        );
        
        actions.push(
          createRowAction({
            key: "sell",
            label: "Sell",
            href: createQuickSellHref({
              productId: row.productId,
              branchId: row.branchId,
            }),
            icon: "newSale",
            showLabel: true,
          }),
        );
      }

      return {
        id: row.id,
        branch: row.branch,
        product: row.product,
        ownedBatches: batchSummary
          ? [
              `${row.ownedQty} total | ${batchSummary.count} batch${batchSummary.count === 1 ? "" : "es"}`,
              ...batchSummary.lines,
            ].join("\n")
          : "No owned stock",
        ownedQty: row.ownedQty,
        sellerQty: row.sellerQty,
        assignedQty: row.assignedQty,
        totalQty: row.totalQty,
        stockValue: Math.max(row.stockValue, 0),
        ...(actions.length > 0 ? { __actions: actions } : {}),
      } satisfies SimpleRow;
    },
  ).filter((row) => Number(row.totalQty) > 0);
}

export async function getStockOverviewMetrics(branchId?: string | null) {
  const summary = await getStockSummaryRows(branchId ?? undefined);
  
  let totalValue = 0;
  let totalOwnedItems = 0;
  const uniqueInStock = new Set<string>();

  for (const row of summary) {
    if (row.totalQty > 0) {
      uniqueInStock.add(row.productId);
      totalValue += row.stockValue;
      totalOwnedItems += row.ownedQty;
    }
  }

  return [
    {
      title: "Total Owned Stock Value",
      value: formatCurrency(totalValue),
      meta: `Based on cost for ${totalOwnedItems} owned units`,
    },
    {
      title: "Items in Stock",
      value: String(uniqueInStock.size),
      meta: "Across all active locations",
    },
  ];
}

export async function getLowStockRows(branchId?: string) {
  const stockSummary = await getStockSummaryRows(branchId);

  return stockSummary
    .filter(
      (row) => row.minimumStockAlert > 0 && row.totalQty <= row.minimumStockAlert,
    )
    .map(
      (row) =>
        ({
          id: row.id,
          branch: row.branch,
          name: row.product,
          currentStock: row.totalQty,
          minimumStockAlert: row.minimumStockAlert,
          status:
            row.totalQty <= Math.max(1, Math.floor(row.minimumStockAlert / 2))
              ? "CRITICAL"
              : "LOW",
        }) satisfies SimpleRow,
    );
}

export async function getOutOfStockRows(branchId?: string) {
  const stockSummary = await getStockSummaryRows(branchId);

  return stockSummary
    .filter((row) => row.totalQty <= 0)
    .map(
      (row) =>
        ({
          id: row.id,
          branch: row.branch,
          name: row.product,
          currentStock: row.totalQty,
          minimumStockAlert: row.minimumStockAlert,
          status: "OUT OF STOCK",
          __actions: [
            createRowAction({
              key: "purchase",
              label: "Purchase",
              href: createQuickPurchaseHref({
                productId: row.productId,
                branchId: row.branchId,
              }),
              icon: "newPurchase",
            }),
          ],
        }) satisfies SimpleRow,
    );
}

export async function getAlertRecordRows(branchId?: string) {
  const records = await prisma.alertRecord.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      branch: {
        select: {
          name: true,
        },
      },
      product: {
        select: {
          name: true,
        },
      },
    },
  });

  return records.map(
    (record) =>
      ({
        id: record.id,
        branch: record.branch.name,
        product: record.product.name,
        threshold: record.threshold,
        quantityAtAlert: record.quantityAtAlert,
        status: record.isResolved ? "RESOLVED" : "OPEN",
        createdAt: record.createdAt.toISOString(),
      }) satisfies SimpleRow,
  );
}

export async function getStockMovementRows(filters: { branchId?: string; productId?: string } = {}) {
  const rows = await prisma.stockMovement.findMany({
    where: {
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.productId ? { productId: filters.productId } : {}),
    },
    orderBy: {
      movementDate: "desc",
    },
    include: {
      branch: {
        select: {
          name: true,
        },
      },
      product: {
        select: {
          name: true,
        },
      },
    },
  });

  return rows.map(
    (row) => {
      const reference = row.sourceLineId ?? row.sourceId;
      const typeStr = toTitleCase(row.movementType.replace(/_/g, " "));
      const actionVerb =
        row.movementType === "SALE" ? "Sold" :
        row.movementType === "PURCHASE" ? "Purchased" :
        row.movementType === "TRANSFER_IN" ? "Received transfer" :
        row.movementType === "TRANSFER_OUT" ? "Sent transfer" :
        row.movementType === "SELLER_RETURN" || row.movementType === "CUSTOMER_RETURN" ? "Returned" :
        row.movementType.includes("ADJUSTMENT") ? "Adjusted" : typeStr;

      return {
        id: row.id,
        branch: row.branch.name,
        product: row.product.name,
        type: row.movementType,
        ownership: row.ownershipType,
        quantity: row.quantity > 0 ? `+${row.quantity}` : `${row.quantity}`,
        reference: reference,
        notes: `${actionVerb} via ${row.sourceType.toLowerCase()} ${reference.slice(0, 8)}`,
        movementDate: row.movementDate.toISOString(),
      } satisfies SimpleRow;
    }
  );
}

export async function getTransferRows(branchId?: string) {
  const transfers = await prisma.transfer.findMany({
    where: {
      ...(branchId
        ? {
            OR: [
              { sourceBranchId: branchId },
              { destinationBranchId: branchId },
            ],
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      sourceBranch: {
        select: {
          name: true,
        },
      },
      destinationBranch: {
        select: {
          name: true,
        },
      },
      items: {
        select: {
          quantity: true,
        },
      },
    },
  });

  return transfers.map(
    (transfer) =>
      ({
        id: transfer.id,
        transferNumber: transfer.transferNumber,
        sourceBranch: transfer.sourceBranch.name,
        destinationBranch: transfer.destinationBranch.name,
        itemCount: transfer.items.length,
        totalQuantity: sumRows(transfer.items.map((item) => item.quantity)),
        status: transfer.status,
        transferDate: (transfer.sentAt ?? transfer.createdAt).toISOString(),
      }) satisfies SimpleRow,
  );
}
