import { getCurrentUser } from "@/lib/auth/session";
import {
  dedupeCashAccountsPerBranch,
  toFinanceAccountOption,
} from "@/lib/finance-account-utils";
import { getOwnedStockBatches } from "@/lib/owned-stock-batches";
import { prisma } from "@/lib/prisma";
import { getStockSummaryRows } from "@/lib/stock-runtime-data";
import type {
  BranchOption,
  CustomerPaymentFormOptions,
  CashTransferAccountOption,
  CashTransferFormOptions,
  ExpenseFormOptions,
  FinanceAccountFormOptions,
  FinanceAccountOption,
  OutstandingSellerBalanceOption,
  OutstandingSaleOption,
  OwnedStockBatchOption,
  ProductOption,
  PurchaseFormOptions,
  SaleBranchStockOption,
  SaleFormOptions,
  SellerAssignmentFormOptions,
  SellerCollectionFormOptions,
  SellerIntakeFormOptions,
  SellerReturnFormOptions,
  SellerSettlementFormOptions,
  SupplierPaymentFormOptions,
  TransferFormOptions,
  UserFormOptions,
} from "@/lib/types";

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function toCashTransferAccountOption(account: {
  id: string;
  name: string;
  type: "CASH" | "BANK";
  branchId: string | null;
  bankName: string | null;
  accountNumber: string | null;
  branch: { name: string } | null;
  ledgerEntries: {
    amount: unknown;
    direction: "DEBIT" | "CREDIT";
  }[];
}): CashTransferAccountOption {
  return {
    ...toFinanceAccountOption(account),
    balance: Number(
      account.ledgerEntries
        .reduce((sum, entry) => {
          const amount = toNumber(entry.amount);
          return entry.direction === "DEBIT" ? sum + amount : sum - amount;
        }, 0)
        .toFixed(2),
    ),
  };
}

function createSellerReturnLineId(prefix: "INTAKE" | "ASSIGNMENT", id: string) {
  return `${prefix}:${id}`;
}

async function getCurrentBranchScope() {
  const user = await getCurrentUser();

  return {
    activeBranchId: user?.activeBranchId ?? "",
    branches: user?.branches ?? [],
    role: user?.role ?? "SALES",
  };
}

export async function getFinanceAccountFormOptions(): Promise<FinanceAccountFormOptions> {
  const scope = await getCurrentBranchScope();
  const branchIds = scope.branches.map((branch) => branch.id);
  const cashAccounts = branchIds.length
    ? await prisma.financeAccount.findMany({
        where: {
          isActive: true,
          type: "CASH",
          branchId: {
            in: branchIds,
          },
        },
        select: {
          branchId: true,
        },
      })
    : [];

  const globalCashCount = await prisma.financeAccount.count({
    where: {
      type: "CASH",
      isActive: true,
    },
  });

  return {
    branches: scope.branches,
    cashBranchIds: cashAccounts
      .map((account) => account.branchId)
      .filter((branchId): branchId is string => Boolean(branchId)),
    hasGlobalCash: globalCashCount > 0,
  };
}

export async function getActiveBranchOptions(): Promise<BranchOption[]> {
  const branches = await prisma.branch.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
  });

  return branches;
}

async function getActiveProductOptions(): Promise<ProductOption[]> {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
    },
  });

  return products;
}

async function getSaleBranchStockOptions(
  branchIds: string[],
): Promise<SaleBranchStockOption[]> {
  if (branchIds.length === 0) {
    return [];
  }

  // Retrieve the current branch scope to get the user's role
  const scope = await getCurrentBranchScope();

  const [stockSummary, ownedBatches, sellerIntakeItems] =
    await Promise.all([
      getStockSummaryRows(),
      // Pass the role from the scope when fetching owned stock batches
      getOwnedStockBatches({ branchIds, role: scope.role }),
      prisma.sellerIntakeItem.findMany({
        where: {
          sellerIntake: {
            branchId: {
              in: branchIds,
            },
          },
        },
        orderBy: [{ bringingDate: "asc" }, { createdAt: "asc" }],
        select: {
          productId: true,
          quantityBrought: true,
          quantityAssigned: true,
          quantitySold: true,
          quantityReturned: true,
          sellerFixedPrice: true,
          targetSellingPrice: true,
          bringingDate: true,
          sellerIntake: {
            select: {
              branchId: true,
            },
          },
        },
      }),
    ]);

  const defaultPriceMap = new Map<string, { defaultUnitPrice: number; dateValue: number }>();

  function setDefaultPrice(args: {
    branchId: string;
    productId: string;
    defaultUnitPrice: number;
    dateValue: number;
  }) {
    const key = `${args.branchId}:${args.productId}`;
    const existing = defaultPriceMap.get(key);

    if (!existing || args.dateValue < existing.dateValue) {
      defaultPriceMap.set(key, {
        defaultUnitPrice: args.defaultUnitPrice,
        dateValue: args.dateValue,
      });
    }
  }

  for (const batch of ownedBatches) {
    setDefaultPrice({
      branchId: batch.branchId,
      productId: batch.productId,
      defaultUnitPrice: batch.sellingPrice,
      dateValue: new Date(batch.receivedAt).getTime(),
    });
  }

  for (const item of sellerIntakeItems) {
    const availableQty =
      item.quantityBrought -
      item.quantityAssigned -
      item.quantitySold -
      item.quantityReturned;

    if (availableQty <= 0) {
      continue;
    }

    setDefaultPrice({
      branchId: item.sellerIntake.branchId,
      productId: item.productId,
      defaultUnitPrice: toNumber(item.targetSellingPrice ?? item.sellerFixedPrice),
      dateValue: item.bringingDate.getTime(),
    });
  }

  return stockSummary
    .filter(
      (row) => branchIds.includes(row.branchId) && row.totalQty > 0,
    )
    .map((row) => ({
        branchId: row.branchId,
        productId: row.productId,
        availableQty: row.totalQty,
        defaultUnitPrice:
          defaultPriceMap.get(`${row.branchId}:${row.productId}`)?.defaultUnitPrice ??
          0,
      }) satisfies SaleBranchStockOption);
}


export async function getPurchaseFormOptions(): Promise<PurchaseFormOptions> {
  const scope = await getCurrentBranchScope();
  const branchIds = scope.branches.map((branch) => branch.id);
  const [suppliers, products, rawAccounts] = await Promise.all([
    prisma.supplier.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
    getActiveProductOptions(),
    prisma.financeAccount.findMany({
      where: {
        isActive: true,
        ...(branchIds.length > 0
          ? {
              OR: [{ branchId: null }, { branchId: { in: branchIds } }],
            }
          : { branchId: null }),
      },
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        branchId: true,
        bankName: true,
        accountNumber: true,
        branch: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);
  const accounts = dedupeCashAccountsPerBranch(rawAccounts);

  return {
    branches: scope.branches,
    suppliers,
    products,
    accounts: accounts.map(
      (account) => toFinanceAccountOption(account),
    ),
  };
}

export async function getSaleFormOptions(): Promise<SaleFormOptions> {
  const scope = await getCurrentBranchScope();
  const branchIds = scope.branches.map((branch) => branch.id);
  const [
    customers,
    products,
    ownedBatches,
    branchStock,
    rawAccounts,
    sellerIntakeItems,
  ] = await Promise.all([
    prisma.customer.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
    getActiveProductOptions(),
    getOwnedStockBatches({
      branchIds,
    }),
    getSaleBranchStockOptions(branchIds),
    prisma.financeAccount.findMany({
      where: {
        isActive: true,
        ...(branchIds.length > 0
          ? {
              OR: [{ branchId: null }, { branchId: { in: branchIds } }],
            }
          : { branchId: null }),
      },
      orderBy: [{ type: "asc" }, { branch: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        branchId: true,
        bankName: true,
        accountNumber: true,
        branch: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.sellerIntakeItem.findMany({
      where: {
        sellerIntake: {
          branchId: {
            in: branchIds,
          },
        },
      },
      select: {
        id: true,
        productId: true,
        quantityBrought: true,
        quantityAssigned: true,
        quantitySold: true,
        quantityReturned: true,
        sellerFixedPrice: true,
        targetSellingPrice: true,
        bringingDate: true,
        product: {
          select: {
            name: true,
          },
        },
        sellerIntake: {
          select: {
            intakeNumber: true,
            branchId: true,
            branch: {
              select: {
                name: true,
              },
            },
            seller: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const normalizedIntakeBatches = sellerIntakeItems
    .map((item) => {
      const remainingQuantity =
        item.quantityBrought -
        item.quantityAssigned -
        item.quantitySold -
        item.quantityReturned;

      return {
        id: item.id,
        branchId: item.sellerIntake.branchId,
        branchName: item.sellerIntake.branch.name,
        productId: item.productId,
        productName: item.product.name,
        sourceType: "SELLER_CONSIGNMENT" as const,
        referenceNumber: item.sellerIntake.intakeNumber,
        sourceName: `Seller: ${item.sellerIntake.seller.fullName}`,
        receivedAt: item.bringingDate.toISOString(),
        quantity: item.quantityBrought,
        quantityAdjustment: 0,
        adjustedQuantity: item.quantityBrought,
        soldQuantity: item.quantitySold,
        transferredQuantity: item.quantityAssigned,
        remainingQuantity,
        unitCost: toNumber(item.sellerFixedPrice),
        sellingPrice: toNumber(item.targetSellingPrice ?? item.sellerFixedPrice),
      } satisfies OwnedStockBatchOption;
    })
    .filter((b) => b.remainingQuantity > 0);

  const allBatches = [
    ...ownedBatches,
    ...normalizedIntakeBatches,
  ].sort((left, right) => {
    const dateDiff =
      new Date(left.receivedAt).getTime() - new Date(right.receivedAt).getTime();

    if (dateDiff !== 0) {
      return dateDiff;
    }

    if (left.branchName === right.branchName) {
      return left.referenceNumber.localeCompare(right.referenceNumber);
    }

    return left.branchName.localeCompare(right.branchName);
  });

  const inStockProductIds = new Set(branchStock.map((item) => item.productId));
  const accounts = dedupeCashAccountsPerBranch(rawAccounts);

  return {
    branches: scope.branches,
    customers,
    products: products.filter((product) => inStockProductIds.has(product.id)),
    branchStock,
    ownedBatches: allBatches,
    accounts: accounts.map((account) => toFinanceAccountOption(account)),
  };
}

export async function getSellerIntakeFormOptions(): Promise<SellerIntakeFormOptions> {
  const scope = await getCurrentBranchScope();
  const [sellers, products] = await Promise.all([
    prisma.seller.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        fullName: "asc",
      },
      select: {
        id: true,
        fullName: true,
      },
    }),
    getActiveProductOptions(),
  ]);

  return {
    branches: scope.branches,
    sellers: sellers.map((seller) => ({
      id: seller.id,
      name: seller.fullName,
    })),
    products,
  };
}

export async function getSellerAssignmentFormOptions(): Promise<SellerAssignmentFormOptions> {
  const scope = await getCurrentBranchScope();
  const [sellers, ownedBatches] = await Promise.all([
    prisma.seller.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        fullName: "asc",
      },
      select: {
        id: true,
        fullName: true,
      },
    }),
    getOwnedStockBatches({
      branchIds: scope.branches.map((branch) => branch.id),
      role: scope.role,
    }),
  ]);

  return {
    branches: scope.branches,
    sellers: sellers.map((seller) => ({
      id: seller.id,
      name: seller.fullName,
    })),
    ownedBatches,
  };
}

export async function getSellerReturnFormOptions(
  sellerId?: string,
): Promise<SellerReturnFormOptions> {
  const scope = await getCurrentBranchScope();
  const branchIds = scope.branches.map((branch) => branch.id);

  if (branchIds.length === 0) {
    return {
      branches: scope.branches,
      sellers: [],
      lines: [],
    };
  }

  const [intakeItems, assignmentItems] = await Promise.all([
    prisma.sellerIntakeItem.findMany({
      where: {
        sellerIntake: {
          branchId: {
            in: branchIds,
          },
          ...(sellerId ? { sellerId } : {}),
        },
      },
      orderBy: [{ bringingDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        productId: true,
        quantityBrought: true,
        quantityAssigned: true,
        quantitySold: true,
        quantityReturned: true,
        bringingDate: true,
        product: {
          select: {
            name: true,
          },
        },
        sellerIntake: {
          select: {
            intakeNumber: true,
            sellerId: true,
            branchId: true,
            branch: {
              select: {
                name: true,
              },
            },
            seller: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    }),
    prisma.sellerAssignmentItem.findMany({
      where: {
        OR: [{ purchaseItemId: { not: null } }, { transferItemId: { not: null } }],
        sellerAssignment: {
          branchId: {
            in: branchIds,
          },
          ...(sellerId ? { sellerId } : {}),
        },
      },
      orderBy: [{ assignmentDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        productId: true,
        quantityAssigned: true,
        quantitySold: true,
        quantityReturned: true,
        assignmentDate: true,
        product: {
          select: {
            name: true,
          },
        },
        sellerAssignment: {
          select: {
            assignmentNumber: true,
            sellerId: true,
            branchId: true,
            branch: {
              select: {
                name: true,
              },
            },
            seller: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const intakeLines = intakeItems
    .map((item) => {
      const availableQty =
        item.quantityBrought -
        item.quantityAssigned -
        item.quantitySold -
        item.quantityReturned;

      return {
        id: createSellerReturnLineId("INTAKE", item.id),
        sellerId: item.sellerIntake.sellerId,
        sellerName: item.sellerIntake.seller.fullName,
        branchId: item.sellerIntake.branchId,
        branchName: item.sellerIntake.branch.name,
        productId: item.productId,
        productName: item.product.name,
        sourceLabel: item.sellerIntake.intakeNumber,
        sourceDate: item.bringingDate.toISOString(),
        availableQty,
        direction: "TO_PARTNER" as const,
        intakeItemId: item.id,
      };
    })
    .filter((line) => line.availableQty > 0);

  const assignmentLines = assignmentItems
    .map((item) => {
      const availableQty =
        item.quantityAssigned - item.quantitySold - item.quantityReturned;

      return {
        id: createSellerReturnLineId("ASSIGNMENT", item.id),
        sellerId: item.sellerAssignment.sellerId,
        sellerName: item.sellerAssignment.seller.fullName,
        branchId: item.sellerAssignment.branchId,
        branchName: item.sellerAssignment.branch.name,
        productId: item.productId,
        productName: item.product.name,
        sourceLabel: item.sellerAssignment.assignmentNumber,
        sourceDate: item.assignmentDate.toISOString(),
        availableQty,
        direction: "BACK_TO_BRANCH" as const,
        assignmentItemId: item.id,
      };
    })
    .filter((line) => line.availableQty > 0);

  const lines = [...intakeLines, ...assignmentLines].sort((left, right) => {
    if (left.branchName === right.branchName) {
      if (left.sellerName === right.sellerName) {
        return left.sourceDate.localeCompare(right.sourceDate);
      }

      return left.sellerName.localeCompare(right.sellerName);
    }

    return left.branchName.localeCompare(right.branchName);
  });

  const sellers = [
    ...new Map(
      lines.map((line) => [
        line.sellerId,
        {
          id: line.sellerId,
          name: line.sellerName,
        },
      ]),
    ).values(),
  ].sort((left, right) => left.name.localeCompare(right.name));

  return {
    branches: scope.branches,
    sellers,
    lines,
  };
}

export async function getUserFormOptions(): Promise<UserFormOptions> {
  const branches = await getActiveBranchOptions();

  return {
    branches,
  };
}

export async function getTransferFormOptions(): Promise<TransferFormOptions> {
  const scope = await getCurrentBranchScope();
  const [products, ownedBatches] = await Promise.all([
    getActiveProductOptions(),
    getOwnedStockBatches({
      branchIds: scope.branches.map((branch) => branch.id),
    }),
  ]);

  const inStockProductIds = new Set(ownedBatches.map((batch) => batch.productId));

  return {
    branches: scope.branches,
    products: products.filter((product) => inStockProductIds.has(product.id)),
    ownedBatches,
  };
}

export async function getCustomerPaymentFormOptions(
  customerId?: string,
): Promise<CustomerPaymentFormOptions> {
  const scope = await getCurrentBranchScope();

  if (!scope.activeBranchId) {
    return {
      customers: [],
      accounts: [],
      outstandingSales: [],
    };
  }

  const [customers, rawAccounts, outstandingSales] = await Promise.all([
    prisma.customer.findMany({
      where: {
        isActive: true,
        sales: {
          some: {
            amountDue: {
              gt: 0,
            },
            status: "COMPLETED",
            branchId: scope.activeBranchId,
          },
        },
        ...(customerId ? { id: customerId } : {}),
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.financeAccount.findMany({
      where: {
        isActive: true,
        OR: [{ branchId: null }, { branchId: scope.activeBranchId }],
      },
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        branchId: true,
        bankName: true,
        accountNumber: true,
        branch: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.sale.findMany({
      where: {
        status: "COMPLETED",
        amountDue: {
          gt: 0,
        },
        customerId: {
          not: null,
        },
        branchId: scope.activeBranchId,
        ...(customerId ? { customerId } : {}),
      },
      orderBy: [{ soldAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        saleNumber: true,
        customerId: true,
        soldAt: true,
        amountDue: true,
        branchId: true,
        branch: {
          select: {
            name: true,
          },
        },
        customer: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);
  const accounts = dedupeCashAccountsPerBranch(rawAccounts);

  return {
    customers,
    accounts: accounts.map(
      (account) => toFinanceAccountOption(account),
    ),
    outstandingSales: outstandingSales
      .filter(
        (sale): sale is typeof sale & { customerId: string } =>
          Boolean(sale.customerId),
      )
      .map(
        (sale) =>
          ({
            id: sale.id,
            saleNumber: sale.saleNumber,
            customerId: sale.customerId,
            customerName: sale.customer?.name ?? "Unknown Customer",
            branchId: sale.branchId,
            branchName: sale.branch.name,
            amountDue: toNumber(sale.amountDue),
            soldAt: sale.soldAt.toISOString(),
          }) satisfies OutstandingSaleOption,
      ),
  };
}

export async function getSupplierPaymentFormOptions(
  supplierId?: string,
): Promise<SupplierPaymentFormOptions> {
  const scope = await getCurrentBranchScope();

  if (!scope.activeBranchId) {
    return {
      suppliers: [],
      accounts: [],
      outstandingPurchases: [],
    };
  }

  const [suppliers, rawAccounts, outstandingPurchases] = await Promise.all([
    prisma.supplier.findMany({
      where: {
        isActive: true,
        purchases: {
          some: {
            amountDue: {
              gt: 0,
            },
            status: "POSTED",
            branchId: scope.activeBranchId,
          },
        },
        ...(supplierId ? { id: supplierId } : {}),
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.financeAccount.findMany({
      where: {
        isActive: true,
        OR: [{ branchId: null }, { branchId: scope.activeBranchId }],
      },
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        branchId: true,
        bankName: true,
        accountNumber: true,
        branch: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.purchase.findMany({
      where: {
        status: "POSTED",
        amountDue: {
          gt: 0,
        },
        branchId: scope.activeBranchId,
        ...(supplierId ? { supplierId } : { supplierId: { not: null } }),
      },
      orderBy: [{ purchasedAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        purchaseNumber: true,
        supplierId: true,
        amountDue: true,
        purchasedAt: true,
        branchId: true,
        branch: {
          select: {
            name: true,
          },
        },
        supplier: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);
  const accounts = dedupeCashAccountsPerBranch(rawAccounts);

  return {
    suppliers,
    accounts: accounts.map(
      (account) => toFinanceAccountOption(account),
    ),
    outstandingPurchases: outstandingPurchases.map((purchase) => ({
      id: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      supplierId: purchase.supplierId ?? "",
      supplierName: purchase.supplier?.name ?? "No supplier",
      branchId: purchase.branchId,
      branchName: purchase.branch.name,
      amountDue: toNumber(purchase.amountDue),
      purchasedAt: purchase.purchasedAt.toISOString(),
    })),
  };
}

export async function getSellerSettlementFormOptions(
  sellerId?: string,
  branchId?: string,
): Promise<SellerSettlementFormOptions> {
  const scope = await getCurrentBranchScope();
  const resolvedBranchId =
    (branchId && scope.branches.some((branch) => branch.id === branchId) ? branchId : undefined) ??
    scope.activeBranchId;

  if (!resolvedBranchId) {
    return {
      sellers: [],
      accounts: [],
      outstandingBalances: [],
      lines: [],
    };
  }

  const [rawAccounts, allocations] = await Promise.all([
    prisma.financeAccount.findMany({
      where: {
        isActive: true,
        OR: [{ branchId: null }, { branchId: resolvedBranchId }],
      },
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        branchId: true,
        bankName: true,
        accountNumber: true,
        branch: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.saleItemAllocation.findMany({
      where: {
        sourceType: {
          in: ["SELLER_CONSIGNMENT", "SELLER_ASSIGNED"],
        },
        saleItem: {
          sale: {
            branchId: resolvedBranchId,
          },
        },
        OR: [
          {
            sellerIntakeItem: {
              sellerIntake: {
                ...(sellerId ? { sellerId } : {}),
              },
            },
          },
          {
            sellerAssignmentItem: {
              sellerIntakeItemId: {
                not: null,
              },
              sellerAssignment: {
                ...(sellerId ? { sellerId } : {}),
              },
            },
          },
        ],
      },
      select: {
        id: true,
        quantity: true,
        sellerAmount: true,
        settlementAllocations: {
          select: {
            amount: true,
          },
        },
        saleItem: {
          select: {
            product: {
              select: {
                name: true,
              },
            },
            sale: {
              select: {
                saleNumber: true,
                soldAt: true,
                branchId: true,
                branch: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        sellerIntakeItem: {
          select: {
            sellerIntake: {
              select: {
                sellerId: true,
                seller: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
        },
        sellerAssignmentItem: {
          select: {
            sellerIntakeItemId: true,
            sellerAssignment: {
              select: {
                sellerId: true,
                seller: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);
  const accounts = dedupeCashAccountsPerBranch(rawAccounts);
  const lines = allocations
    .map((allocation) => {
      const assignmentSeller =
        allocation.sellerAssignmentItem?.sellerIntakeItemId
          ? allocation.sellerAssignmentItem.sellerAssignment
          : null;
      const sellerIdValue =
        assignmentSeller?.sellerId ??
        allocation.sellerIntakeItem?.sellerIntake.sellerId;
      const sellerName =
        assignmentSeller?.seller.fullName ??
        allocation.sellerIntakeItem?.sellerIntake.seller.fullName;
      const branchId = allocation.saleItem.sale.branchId;
      const branchName = allocation.saleItem.sale.branch.name;
      const amountDue = Number(
        (
          toNumber(allocation.sellerAmount) * allocation.quantity -
          allocation.settlementAllocations.reduce(
            (sum, item) => sum + toNumber(item.amount),
            0,
          )
        ).toFixed(2),
      );

      if (!sellerIdValue || !sellerName || amountDue <= 0) {
        return null;
      }

      return {
        id: allocation.id,
        sellerId: sellerIdValue,
        sellerName,
        branchId,
        branchName,
        productName: allocation.saleItem.product.name,
        saleNumber: allocation.saleItem.sale.saleNumber,
        soldAt: allocation.saleItem.sale.soldAt.toISOString(),
        quantity: allocation.quantity,
        amountDue,
      };
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line))
    .sort((left, right) => {
      const soldAtDiff = left.soldAt.localeCompare(right.soldAt);

      if (soldAtDiff !== 0) {
        return soldAtDiff;
      }

      return left.saleNumber.localeCompare(right.saleNumber);
    });
  const balances = new Map<string, OutstandingSellerBalanceOption>();

  for (const line of lines) {
    const key = `${line.sellerId}:${line.branchId}`;
    const existing = balances.get(key);

    balances.set(key, {
      sellerId: line.sellerId,
      sellerName: line.sellerName,
      branchId: line.branchId,
      branchName: line.branchName,
      amountDue: Number(((existing?.amountDue ?? 0) + line.amountDue).toFixed(2)),
    });
  }

  const outstandingBalances = [...balances.values()].sort((left, right) => {
    if (left.sellerName === right.sellerName) {
      return left.branchName.localeCompare(right.branchName);
    }

    return left.sellerName.localeCompare(right.sellerName);
  });

  const sellers = [
    ...new Map(
      outstandingBalances.map((balance) => [
        balance.sellerId,
        {
          id: balance.sellerId,
          name: balance.sellerName,
        },
      ]),
    ).values(),
  ];

  return {
    sellers,
    accounts: accounts.map(
      (account) => toFinanceAccountOption(account),
    ),
    outstandingBalances,
    lines,
  };
}

export async function getSellerCollectionFormOptions(
  sellerId?: string,
  branchId?: string,
): Promise<SellerCollectionFormOptions> {
  const scope = await getCurrentBranchScope();
  const resolvedBranchId =
    (branchId && scope.branches.some((branch) => branch.id === branchId) ? branchId : undefined) ??
    scope.activeBranchId;

  if (!resolvedBranchId) {
    return {
      sellers: [],
      accounts: [],
      lines: [],
    };
  }

  const [rawAccounts, allocations] = await Promise.all([
    prisma.financeAccount.findMany({
      where: {
        isActive: true,
        OR: [{ branchId: null }, { branchId: resolvedBranchId }],
      },
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        branchId: true,
        bankName: true,
        accountNumber: true,
        branch: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.saleItemAllocation.findMany({
      where: {
        sourceType: "SELLER_ASSIGNED",
        saleItem: {
          sale: {
            branchId: resolvedBranchId,
          },
        },
        sellerAssignmentItem: {
          sellerIntakeItemId: null,
          sellerAssignment: {
            ...(sellerId ? { sellerId } : {}),
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        quantity: true,
        sellerAmount: true,
        collectionAllocations: {
          select: {
            amount: true,
          },
        },
        saleItem: {
          select: {
            sale: {
              select: {
                saleNumber: true,
                soldAt: true,
                branchId: true,
                branch: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        sellerAssignmentItem: {
          select: {
            sellerAssignment: {
              select: {
                sellerId: true,
                seller: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);
  const accounts = dedupeCashAccountsPerBranch(rawAccounts);

  const lines = allocations
    .map((allocation) => {
      const amountDue = Number(
        (
          toNumber(allocation.sellerAmount) * allocation.quantity -
          allocation.collectionAllocations.reduce(
            (sum, item) => sum + toNumber(item.amount),
            0,
          )
        ).toFixed(2),
      );
      const assignment = allocation.sellerAssignmentItem?.sellerAssignment;
      const product = allocation.sellerAssignmentItem?.product;
      const sale = allocation.saleItem.sale;

      if (!assignment || !product || amountDue <= 0) {
        return null;
      }

      return {
        id: allocation.id,
        sellerId: assignment.sellerId,
        sellerName: assignment.seller.fullName,
        branchId: sale.branchId,
        branchName: sale.branch.name,
        productId: product.id,
        productName: product.name,
        saleNumber: sale.saleNumber,
        soldAt: sale.soldAt.toISOString(),
        quantity: allocation.quantity,
        amountDue,
      };
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line))
    .sort((left, right) => {
      const soldAtDiff = left.soldAt.localeCompare(right.soldAt);

      if (soldAtDiff !== 0) {
        return soldAtDiff;
      }

      return left.saleNumber.localeCompare(right.saleNumber);
    });

  const sellers = [
    ...new Map(
      lines.map((line) => [
        line.sellerId,
        {
          id: line.sellerId,
          name: line.sellerName,
        },
      ]),
    ).values(),
  ].sort((left, right) => left.name.localeCompare(right.name));

  return {
    sellers,
    accounts: accounts.map((account) => toFinanceAccountOption(account)),
    lines,
  };
}

export async function getCashTransferFormOptions(): Promise<CashTransferFormOptions> {
  const scope = await getCurrentBranchScope();
  const branchIds = scope.branches.map((branch) => branch.id);

  if (branchIds.length === 0) {
    return {
      branches: scope.branches,
      cashAccounts: [],
      bankAccounts: [],
    };
  }

  const accounts = await prisma.financeAccount.findMany({
    where: {
      isActive: true,
      branchId: {
        in: branchIds,
      },
      type: {
        in: ["CASH", "BANK"],
      },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      branchId: true,
      bankName: true,
      accountNumber: true,
      branch: {
        select: {
          name: true,
        },
      },
      ledgerEntries: {
        select: {
          amount: true,
          direction: true,
        },
      },
    },
  });

  const mappedAccounts = accounts.map((account) =>
    toCashTransferAccountOption(account),
  );
  const operationalAccounts = dedupeCashAccountsPerBranch(mappedAccounts);

  return {
    branches: scope.branches,
    cashAccounts: operationalAccounts.filter((account) => account.type === "CASH"),
    bankAccounts: operationalAccounts.filter((account) => account.type === "BANK"),
  };
}

export async function getExpenseFormOptions(): Promise<ExpenseFormOptions> {
  const scope = await getCurrentBranchScope();
  const branchIds = scope.branches.map((branch) => branch.id);

  if (branchIds.length === 0) {
    return {
      branches: scope.branches,
      accounts: [],
      categoryNames: [],
    };
  }

  const [rawAccounts, categories] = await Promise.all([
    prisma.financeAccount.findMany({
      where: {
        isActive: true,
        branchId: {
          in: branchIds,
        },
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        branchId: true,
        bankName: true,
        accountNumber: true,
        branch: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.expenseCategory.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        name: true,
      },
    }),
  ]);
  const accounts = dedupeCashAccountsPerBranch(rawAccounts);

  return {
    branches: scope.branches,
    accounts: accounts.map((account) => toFinanceAccountOption(account)),
    categoryNames: categories.map((category) => category.name),
  };
}
