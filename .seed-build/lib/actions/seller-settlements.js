"use server";
import { revalidatePath } from "next/cache";
import { LedgerDirection, LedgerEntryType, SettlementStatus } from "@/generated/prisma/enums";
import { createDocumentNumber, getActionActorByPermission, getActionErrorMessage, normalizeOptionalString, parseInputDate, toDecimal, } from "@/lib/actions/common";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { createAuditLog } from "@/lib/services/inventory-ledger";
import { sellerSettlementSchema, } from "@/lib/validation/seller-settlement";
export async function createSellerSettlementAction(input) {
    const actor = await getActionActorByPermission("seller-settlements:create");
    if (!actor) {
        return {
            success: false,
            message: "You are not allowed to record partner settlements.",
        };
    }
    const parsed = sellerSettlementSchema.safeParse(input);
    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Partner settlement details are invalid.",
        };
    }
    const settlementDate = parseInputDate(parsed.data.settlementDate);
    if (!settlementDate) {
        return {
            success: false,
            message: "Settlement date is invalid.",
        };
    }
    const note = normalizeOptionalString(parsed.data.note);
    const selectedLineIds = parsed.data.items.map((item) => item.lineId);
    if (new Set(selectedLineIds).size !== selectedLineIds.length) {
        return {
            success: false,
            message: "Select each sold line only once.",
        };
    }
    if (!hasPermission(actor.role, "accounts:use")) {
        return {
            success: false,
            message: "You are not allowed to use payment accounts for partner settlements.",
        };
    }
    try {
        const settlementReference = await prisma.$transaction(async (tx) => {
            const seller = await tx.seller.findFirst({
                where: {
                    id: parsed.data.sellerId,
                    isActive: true,
                },
                select: {
                    id: true,
                    fullName: true,
                },
            });
            if (!seller) {
                throw new Error("Selected partner was not found.");
            }
            const branch = await tx.branch.findUnique({
                where: {
                    id: parsed.data.branchId,
                },
                select: {
                    id: true,
                    name: true,
                },
            });
            if (!branch) {
                throw new Error("Selected branch was not found.");
            }
            const financeAccount = await tx.financeAccount.findFirst({
                where: {
                    id: parsed.data.financeAccountId,
                    isActive: true,
                },
                select: {
                    id: true,
                    name: true,
                    branchId: true,
                    type: true,
                },
            });
            if (!financeAccount) {
                throw new Error("Selected payment account was not found.");
            }
            if (financeAccount.branchId && financeAccount.branchId !== branch.id) {
                throw new Error("Payment account must belong to the same branch as the settlement.");
            }
            const allocations = await tx.saleItemAllocation.findMany({
                where: {
                    sourceType: {
                        in: ["SELLER_CONSIGNMENT", "SELLER_ASSIGNED"],
                    },
                    id: {
                        in: selectedLineIds,
                    },
                    saleItem: {
                        sale: {
                            branchId: branch.id,
                        },
                    },
                    OR: [
                        {
                            sellerIntakeItem: {
                                sellerIntake: {
                                    sellerId: seller.id,
                                },
                            },
                        },
                        {
                            sellerAssignmentItem: {
                                sellerIntakeItemId: {
                                    not: null,
                                },
                                sellerAssignment: {
                                    sellerId: seller.id,
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
                                },
                            },
                        },
                    },
                },
            });
            if (allocations.length !== selectedLineIds.length) {
                throw new Error("One selected sold line is no longer available for payment.");
            }
            const allocationMap = new Map(allocations.map((allocation) => {
                const amountDue = Number((Number(allocation.sellerAmount ?? 0) * allocation.quantity -
                    allocation.settlementAllocations.reduce((sum, item) => sum + Number(item.amount), 0)).toFixed(2));
                return [
                    allocation.id,
                    {
                        id: allocation.id,
                        amountDue,
                        saleNumber: allocation.saleItem.sale.saleNumber,
                        soldAt: allocation.saleItem.sale.soldAt,
                        productName: allocation.saleItem.product.name,
                    },
                ];
            }));
            const normalizedItems = parsed.data.items.map((item) => {
                const allocation = allocationMap.get(item.lineId);
                if (!allocation) {
                    throw new Error("One selected sold line could not be validated.");
                }
                if (allocation.amountDue <= 0) {
                    throw new Error(`${allocation.productName} on ${allocation.saleNumber} is already fully paid.`);
                }
                const normalizedAmount = Number(Number(item.amount).toFixed(2));
                if (normalizedAmount > allocation.amountDue) {
                    throw new Error(`${allocation.productName} on ${allocation.saleNumber} has only ETB ${allocation.amountDue.toFixed(2)} left to pay.`);
                }
                return {
                    ...item,
                    amount: normalizedAmount,
                    saleNumber: allocation.saleNumber,
                    soldAt: allocation.soldAt,
                };
            });
            const amount = Number(normalizedItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
            if (amount <= 0) {
                throw new Error("Settlement amount must be greater than zero.");
            }
            const settlementNumber = createDocumentNumber("SET", settlementDate);
            const settlement = await tx.sellerSettlement.create({
                data: {
                    settlementNumber,
                    sellerId: seller.id,
                    branchId: branch.id,
                    createdById: actor.id,
                    financeAccountId: financeAccount.id,
                    settlementDate,
                    paymentMethod: financeAccount.type,
                    status: SettlementStatus.POSTED,
                    amount: toDecimal(amount),
                    ...(note ? { note } : {}),
                },
                select: {
                    id: true,
                    settlementNumber: true,
                },
            });
            for (const item of normalizedItems) {
                await tx.sellerSettlementAllocation.create({
                    data: {
                        sellerSettlementId: settlement.id,
                        saleItemAllocationId: item.lineId,
                        amount: toDecimal(item.amount),
                    },
                });
            }
            await tx.ledgerEntry.create({
                data: {
                    entryDate: settlementDate,
                    branchId: branch.id,
                    financeAccountId: financeAccount.id,
                    direction: LedgerDirection.CREDIT,
                    amount: toDecimal(amount),
                    entryType: LedgerEntryType.SELLER_SETTLEMENT,
                    referenceType: "SellerSettlement",
                    referenceId: settlement.id,
                    description: `Partner settlement ${settlement.settlementNumber} for ${seller.fullName}`,
                },
            });
            await createAuditLog(tx, {
                actorUserId: actor.id,
                action: "SELLER_SETTLEMENT",
                entityType: "SellerSettlement",
                entityId: settlement.id,
                branchId: branch.id,
                after: {
                    settlementNumber: settlement.settlementNumber,
                    sellerId: seller.id,
                    sellerName: seller.fullName,
                    branchId: branch.id,
                    branchName: branch.name,
                    amount,
                    financeAccountId: financeAccount.id,
                    financeAccountName: financeAccount.name,
                    lineCount: normalizedItems.length,
                    salesCovered: [...new Set(normalizedItems.map((item) => item.saleNumber))],
                },
            });
            return settlement.settlementNumber;
        });
        revalidatePath("/sellers/list");
        revalidatePath("/sellers/settlements");
        revalidatePath("/sales/sold-items");
        revalidatePath("/sales/daily-check");
        revalidatePath("/reports/sellers");
        revalidatePath("/finance/accounts");
        revalidatePath("/finance/cash");
        revalidatePath("/finance/ledger");
        revalidatePath("/dashboard");
        return {
            success: true,
            message: `Partner settlement ${settlementReference} posted successfully.`,
        };
    }
    catch (error) {
        return {
            success: false,
            message: getActionErrorMessage(error, "Unable to record the partner settlement right now."),
        };
    }
}
