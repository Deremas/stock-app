import { getCurrentUser } from "@/lib/auth/session";
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
  ProductOption,
  PurchaseFormOptions,
  SaleBranchStockOption,
  SaleFormOptions,
  SellerAssignmentFormOptions,
  SellerIntakeFormOptions,
  SellerSettlementFormOptions,
  SupplierPaymentFormOptions,
  TransferFormOptions,
  UserFormOptions,
} from "@/lib/types";

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function toFinanceAccountOption(account: {
  id: string;
  name: string;
  type: "CASH" | "BANK";
  branchId: string | null;
  branch: { name: string } | null;
}): FinanceAccountOption {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    branchId: account.branchId,
    branchName: account.branch?.name ?? null,
  };
}

function toCashTransferAccountOption(account: {
  id: string;
  name: string;
  type: "CASH" | "BANK";
  branchId: string | null;
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

async function getCurrentBranchScope() {
  const user = await getCurrentUser();

  return {
    activeBranchId: user?.activeBranchId ?? "",
    branches: user?.branches ?? [],
  };
}

export async function getFinanceAccountFormOptions(): Promise<FinanceAccountFormOptions> {
  const scope = await getCurrentBranchScope();

  return {
    branches: scope.branches,
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

  const [stockSummary, ownedBatches, sellerIntakeItems, sellerAssignmentItems] =
    await Promise.all([
      getStockSummaryRows(),
      getOwnedStockBatches({ branchIds }),
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
      prisma.sellerAssignmentItem.findMany({
        where: {
          sellerAssignment: {
            branchId: {
              in: branchIds,
            },
          },
        },
        orderBy: [{ assignmentDate: "asc" }, { createdAt: "asc" }],
        select: {
          productId: true,
          quantityAssigned: true,
          quantitySold: true,
          quantityReturned: true,
          assignmentDate: true,
          sellingPrice: true,
          sellerIntakeItem: {
            select: {
              sellerFixedPrice: true,
            },
          },
          sellerAssignment: {
            select: {
              branchId: true,
            },
          },
        },
      }),
    ]);

  const defaultPriceMap = new Map<
    string,
    {
      defaultUnitPrice: number;
      dateValue: number;
    }
  >();

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

  for (const item of sellerAssignmentItems) {
    const availableQty =
      item.quantityAssigned - item.quantitySold - item.quantityReturned;

    if (availableQty <= 0) {
      continue;
    }

    setDefaultPrice({
      branchId: item.sellerAssignment.branchId,
      productId: item.productId,
      defaultUnitPrice: toNumber(
        item.sellingPrice ?? item.sellerIntakeItem?.sellerFixedPrice ?? 0,
      ),
      dateValue: item.assignmentDate.getTime(),
    });
  }

  return stockSummary
    .filter(
      (row) => branchIds.includes(row.branchId) && row.totalQty > 0,
    )
    .map(
      (row) =>
        ({
          branchId: row.branchId,
          productId: row.productId,
          availableQty: row.totalQty,
          defaultUnitPrice:
            defaultPriceMap.get(`${row.branchId}:${row.productId}`)?.defaultUnitPrice ??
            0,
        }) satisfies SaleBranchStockOption,
    );
}

export async function getPurchaseFormOptions(): Promise<PurchaseFormOptions> {
  const scope = await getCurrentBranchScope();
  const branchIds = scope.branches.map((branch) => branch.id);
  const [suppliers, products, accounts] = await Promise.all([
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
        branch: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

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
  const [customers, products, ownedBatches, branchStock] = await Promise.all([
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
      branchIds: scope.branches.map((branch) => branch.id),
    }),
    getSaleBranchStockOptions(scope.branches.map((branch) => branch.id)),
  ]);

  const inStockProductIds = new Set(branchStock.map((item) => item.productId));

  return {
    branches: scope.branches,
    customers,
    products: products.filter((product) => inStockProductIds.has(product.id)),
    branchStock,
    ownedBatches,
  };
}

export async function getSellerIntakeFormOptions(): Promise<SellerIntakeFormOptions> {
  const scope = await getCurrentBranchScope();
  const sellers = await prisma.seller.findMany({
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
  });

  return {
    branches: scope.branches,
    sellers: sellers.map((seller) => ({
      id: seller.id,
      name: seller.fullName,
    })),
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

  return {
    branches: scope.branches,
    products,
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

  const [customers, accounts, outstandingSales] = await Promise.all([
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

  const [suppliers, accounts, outstandingPurchases] = await Promise.all([
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
        ...(supplierId ? { supplierId } : {}),
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

  return {
    suppliers,
    accounts: accounts.map(
      (account) => toFinanceAccountOption(account),
    ),
    outstandingPurchases: outstandingPurchases.map((purchase) => ({
      id: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      supplierId: purchase.supplierId,
      supplierName: purchase.supplier.name,
      branchId: purchase.branchId,
      branchName: purchase.branch.name,
      amountDue: toNumber(purchase.amountDue),
      purchasedAt: purchase.purchasedAt.toISOString(),
    })),
  };
}

export async function getSellerSettlementFormOptions(
  sellerId?: string,
): Promise<SellerSettlementFormOptions> {
  const scope = await getCurrentBranchScope();

  if (!scope.activeBranchId) {
    return {
      sellers: [],
      accounts: [],
      outstandingBalances: [],
    };
  }

  const [accounts, allocations] = await Promise.all([
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
            branchId: scope.activeBranchId,
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
              sellerAssignment: {
                ...(sellerId ? { sellerId } : {}),
              },
            },
          },
        ],
      },
      select: {
        quantity: true,
        sellerAmount: true,
        settlementAllocations: {
          select: {
            amount: true,
          },
        },
        saleItem: {
          select: {
            sale: {
              select: {
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

  const balances = new Map<string, OutstandingSellerBalanceOption>();

  for (const allocation of allocations) {
    const sellerIdValue =
      allocation.sellerAssignmentItem?.sellerAssignment.sellerId ??
      allocation.sellerIntakeItem?.sellerIntake.sellerId;
    const sellerName =
      allocation.sellerAssignmentItem?.sellerAssignment.seller.fullName ??
      allocation.sellerIntakeItem?.sellerIntake.seller.fullName;
    const branchId = allocation.saleItem.sale.branchId;
    const branchName = allocation.saleItem.sale.branch.name;

    if (!sellerIdValue || !sellerName) {
      continue;
    }

    const gross = toNumber(allocation.sellerAmount) * allocation.quantity;
    const settled = allocation.settlementAllocations.reduce(
      (sum, item) => sum + toNumber(item.amount),
      0,
    );
    const amountDue = Number((gross - settled).toFixed(2));

    if (amountDue <= 0) {
      continue;
    }

    const key = `${sellerIdValue}:${branchId}`;
    const existing = balances.get(key);

    balances.set(key, {
      sellerId: sellerIdValue,
      sellerName,
      branchId,
      branchName,
      amountDue: Number(((existing?.amountDue ?? 0) + amountDue).toFixed(2)),
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

  return {
    branches: scope.branches,
    cashAccounts: mappedAccounts.filter((account) => account.type === "CASH"),
    bankAccounts: mappedAccounts.filter((account) => account.type === "BANK"),
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

  const [accounts, categories] = await Promise.all([
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

  return {
    branches: scope.branches,
    accounts: accounts.map((account) => toFinanceAccountOption(account)),
    categoryNames: categories.map((category) => category.name),
  };
}
