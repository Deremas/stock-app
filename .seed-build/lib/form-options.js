import { getCurrentUser } from "@/lib/auth/session";
import { dedupeCashAccountsPerBranch, toFinanceAccountOption, } from "@/lib/finance-account-utils";
import { getOwnedStockBatches } from "@/lib/owned-stock-batches";
import { prisma } from "@/lib/prisma";
import { getStockSummaryRows } from "@/lib/stock-runtime-data";
function toNumber(value) {
    return Number(value ?? 0);
}
function toCashTransferAccountOption(account) {
    return {
        ...toFinanceAccountOption(account),
        balance: Number(account.ledgerEntries
            .reduce((sum, entry) => {
            const amount = toNumber(entry.amount);
            return entry.direction === "DEBIT" ? sum + amount : sum - amount;
        }, 0)
            .toFixed(2)),
    };
}
function createSellerReturnLineId(prefix, id) {
    return `${prefix}:${id}`;
}
async function getCurrentBranchScope() {
    const user = await getCurrentUser();
    return {
        activeBranchId: user?.activeBranchId ?? "",
        branches: user?.branches ?? [],
    };
}
export async function getFinanceAccountFormOptions() {
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
    return {
        branches: scope.branches,
        cashBranchIds: cashAccounts
            .map((account) => account.branchId)
            .filter((branchId) => Boolean(branchId)),
    };
}
export async function getActiveBranchOptions() {
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
async function getActiveProductOptions() {
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
async function getSaleBranchStockOptions(branchIds) {
    if (branchIds.length === 0) {
        return [];
    }
    const [stockSummary, ownedBatches, sellerIntakeItems, sellerAssignmentItems] = await Promise.all([
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
    const defaultPriceMap = new Map();
    function setDefaultPrice(args) {
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
        const availableQty = item.quantityBrought -
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
        const availableQty = item.quantityAssigned - item.quantitySold - item.quantityReturned;
        if (availableQty <= 0) {
            continue;
        }
        setDefaultPrice({
            branchId: item.sellerAssignment.branchId,
            productId: item.productId,
            defaultUnitPrice: toNumber(item.sellingPrice ?? item.sellerIntakeItem?.sellerFixedPrice ?? 0),
            dateValue: item.assignmentDate.getTime(),
        });
    }
    return stockSummary
        .filter((row) => branchIds.includes(row.branchId) && row.totalQty > 0)
        .map((row) => ({
        branchId: row.branchId,
        productId: row.productId,
        availableQty: row.totalQty,
        defaultUnitPrice: defaultPriceMap.get(`${row.branchId}:${row.productId}`)?.defaultUnitPrice ??
            0,
    }));
}
export async function getPurchaseFormOptions() {
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
        accounts: accounts.map((account) => toFinanceAccountOption(account)),
    };
}
export async function getSaleFormOptions() {
    const scope = await getCurrentBranchScope();
    const branchIds = scope.branches.map((branch) => branch.id);
    const [customers, products, ownedBatches, branchStock, rawAccounts] = await Promise.all([
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
    ]);
    const inStockProductIds = new Set(branchStock.map((item) => item.productId));
    const accounts = dedupeCashAccountsPerBranch(rawAccounts);
    return {
        branches: scope.branches,
        customers,
        products: products.filter((product) => inStockProductIds.has(product.id)),
        branchStock,
        ownedBatches,
        accounts: accounts.map((account) => toFinanceAccountOption(account)),
    };
}
export async function getSellerIntakeFormOptions() {
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
export async function getSellerAssignmentFormOptions() {
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
export async function getSellerReturnFormOptions(sellerId) {
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
        const availableQty = item.quantityBrought -
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
            direction: "TO_PARTNER",
        };
    })
        .filter((line) => line.availableQty > 0);
    const assignmentLines = assignmentItems
        .map((item) => {
        const availableQty = item.quantityAssigned - item.quantitySold - item.quantityReturned;
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
            direction: "BACK_TO_BRANCH",
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
        ...new Map(lines.map((line) => [
            line.sellerId,
            {
                id: line.sellerId,
                name: line.sellerName,
            },
        ])).values(),
    ].sort((left, right) => left.name.localeCompare(right.name));
    return {
        branches: scope.branches,
        sellers,
        lines,
    };
}
export async function getUserFormOptions() {
    const branches = await getActiveBranchOptions();
    return {
        branches,
    };
}
export async function getTransferFormOptions() {
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
export async function getCustomerPaymentFormOptions(customerId) {
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
        accounts: accounts.map((account) => toFinanceAccountOption(account)),
        outstandingSales: outstandingSales
            .filter((sale) => Boolean(sale.customerId))
            .map((sale) => ({
            id: sale.id,
            saleNumber: sale.saleNumber,
            customerId: sale.customerId,
            customerName: sale.customer?.name ?? "Unknown Customer",
            branchId: sale.branchId,
            branchName: sale.branch.name,
            amountDue: toNumber(sale.amountDue),
            soldAt: sale.soldAt.toISOString(),
        })),
    };
}
export async function getSupplierPaymentFormOptions(supplierId) {
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
        accounts: accounts.map((account) => toFinanceAccountOption(account)),
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
export async function getSellerSettlementFormOptions(sellerId, branchId) {
    const scope = await getCurrentBranchScope();
    const resolvedBranchId = (branchId && scope.branches.some((branch) => branch.id === branchId) ? branchId : undefined) ??
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
        const assignmentSeller = allocation.sellerAssignmentItem?.sellerIntakeItemId
            ? allocation.sellerAssignmentItem.sellerAssignment
            : null;
        const sellerIdValue = assignmentSeller?.sellerId ??
            allocation.sellerIntakeItem?.sellerIntake.sellerId;
        const sellerName = assignmentSeller?.seller.fullName ??
            allocation.sellerIntakeItem?.sellerIntake.seller.fullName;
        const branchId = allocation.saleItem.sale.branchId;
        const branchName = allocation.saleItem.sale.branch.name;
        const amountDue = Number((toNumber(allocation.sellerAmount) * allocation.quantity -
            allocation.settlementAllocations.reduce((sum, item) => sum + toNumber(item.amount), 0)).toFixed(2));
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
        .filter((line) => Boolean(line))
        .sort((left, right) => {
        const soldAtDiff = left.soldAt.localeCompare(right.soldAt);
        if (soldAtDiff !== 0) {
            return soldAtDiff;
        }
        return left.saleNumber.localeCompare(right.saleNumber);
    });
    const balances = new Map();
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
        ...new Map(outstandingBalances.map((balance) => [
            balance.sellerId,
            {
                id: balance.sellerId,
                name: balance.sellerName,
            },
        ])).values(),
    ];
    return {
        sellers,
        accounts: accounts.map((account) => toFinanceAccountOption(account)),
        outstandingBalances,
        lines,
    };
}
export async function getSellerCollectionFormOptions(sellerId, branchId) {
    const scope = await getCurrentBranchScope();
    const resolvedBranchId = (branchId && scope.branches.some((branch) => branch.id === branchId) ? branchId : undefined) ??
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
        const amountDue = Number((toNumber(allocation.sellerAmount) * allocation.quantity -
            allocation.collectionAllocations.reduce((sum, item) => sum + toNumber(item.amount), 0)).toFixed(2));
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
        .filter((line) => Boolean(line))
        .sort((left, right) => {
        const soldAtDiff = left.soldAt.localeCompare(right.soldAt);
        if (soldAtDiff !== 0) {
            return soldAtDiff;
        }
        return left.saleNumber.localeCompare(right.saleNumber);
    });
    const sellers = [
        ...new Map(lines.map((line) => [
            line.sellerId,
            {
                id: line.sellerId,
                name: line.sellerName,
            },
        ])).values(),
    ].sort((left, right) => left.name.localeCompare(right.name));
    return {
        sellers,
        accounts: accounts.map((account) => toFinanceAccountOption(account)),
        lines,
    };
}
export async function getCashTransferFormOptions() {
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
    const mappedAccounts = accounts.map((account) => toCashTransferAccountOption(account));
    const operationalAccounts = dedupeCashAccountsPerBranch(mappedAccounts);
    return {
        branches: scope.branches,
        cashAccounts: operationalAccounts.filter((account) => account.type === "CASH"),
        bankAccounts: operationalAccounts.filter((account) => account.type === "BANK"),
    };
}
export async function getExpenseFormOptions() {
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
