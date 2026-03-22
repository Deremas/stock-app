import { prisma } from "@/lib/prisma";
import { getOwnedStockBatches } from "@/lib/owned-stock-batches";
import type { RowActionConfig, SimpleRow } from "@/lib/table";
import { sumRows } from "@/lib/data-runtime-utils";
import { getStockSummaryRows } from "@/lib/stock-runtime-data";
import { formatCurrency } from "@/lib/utils";

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

  return `/inventory/stock-overview?${params.toString()}`;
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
            icon: "settings",
          }),
        ],
      }) satisfies SimpleRow,
  );
}

export async function getStockOverviewRows(branchId?: string) {
  const [rows, ownedBatches] = await Promise.all([
    getStockSummaryRows(branchId),
    getOwnedStockBatches(branchId ? { branchId } : {}),
  ]);

  const ownedBatchMap = new Map<
    string,
    {
      count: number;
      minSellingPrice: number;
      maxSellingPrice: number;
    }
  >();

  for (const batch of ownedBatches) {
    const key = `${batch.branchId}:${batch.productId}`;
    const existing = ownedBatchMap.get(key);

    if (!existing) {
      ownedBatchMap.set(key, {
        count: 1,
        minSellingPrice: batch.sellingPrice,
        maxSellingPrice: batch.sellingPrice,
      });
      continue;
    }

    existing.count += 1;
    existing.minSellingPrice = Math.min(existing.minSellingPrice, batch.sellingPrice);
    existing.maxSellingPrice = Math.max(existing.maxSellingPrice, batch.sellingPrice);
  }

  return rows.map(
    (row) => {
      const batchSummary = ownedBatchMap.get(`${row.branchId}:${row.productId}`);
      const actions: RowActionConfig[] = [];

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
          }),
        );
      }

      if (row.totalQty > 0) {
        actions.push(
          createRowAction({
            key: "sell",
            label: "Sell",
            href: createQuickSellHref({
              productId: row.productId,
              branchId: row.branchId,
            }),
            icon: "newSale",
          }),
        );
      }

      return {
        id: row.id,
        branch: row.branch,
        product: row.product,
        ownedBatches: batchSummary
          ? `${batchSummary.count} batch${batchSummary.count === 1 ? "" : "es"} | ${
              batchSummary.minSellingPrice === batchSummary.maxSellingPrice
                ? formatCurrency(batchSummary.minSellingPrice)
                : `${formatCurrency(batchSummary.minSellingPrice)} - ${formatCurrency(
                    batchSummary.maxSellingPrice,
                  )}`
            }`
          : "-",
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

export async function getStockMovementRows(branchId?: string) {
  const rows = await prisma.stockMovement.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
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
    (row) =>
      ({
        id: row.id,
        branch: row.branch.name,
        product: row.product.name,
        type: row.movementType,
        ownership: row.ownershipType,
        quantity: row.quantity,
        reference: row.sourceLineId ?? row.sourceId,
        movementDate: row.movementDate.toISOString(),
      }) satisfies SimpleRow,
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
