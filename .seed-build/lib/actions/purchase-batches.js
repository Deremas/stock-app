"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActionActor, getActionErrorMessage, toDecimal, } from "@/lib/actions/common";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/inventory-ledger";
const purchaseBatchPriceSchema = z.object({
    batchId: z.string().min(1, "Batch is required."),
    sellingPrice: z.coerce.number().nonnegative("Selling price must be zero or more."),
});
export async function updatePurchaseBatchSellingPriceAction(input) {
    const actor = await getActionActor(["ADMIN"]);
    if (!actor) {
        return {
            success: false,
            message: "Only admins can update batch prices.",
        };
    }
    const parsed = purchaseBatchPriceSchema.safeParse(input);
    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Batch selling price is invalid.",
        };
    }
    try {
        const batchReference = await prisma.$transaction(async (tx) => {
            const [purchaseBatch, transferBatch] = await Promise.all([
                tx.purchaseItem.findFirst({
                    where: {
                        id: parsed.data.batchId,
                        purchase: {
                            status: "POSTED",
                            branch: {
                                isActive: true,
                                userAssignments: {
                                    some: {
                                        userId: actor.id,
                                        isActive: true,
                                    },
                                },
                            },
                        },
                    },
                    select: {
                        id: true,
                        quantity: true,
                        quantityTransferred: true,
                        sellingPrice: true,
                        saleAllocations: {
                            select: {
                                quantity: true,
                            },
                        },
                        product: {
                            select: {
                                name: true,
                            },
                        },
                        purchase: {
                            select: {
                                purchaseNumber: true,
                                branchId: true,
                            },
                        },
                    },
                }),
                tx.transferItem.findFirst({
                    where: {
                        id: parsed.data.batchId,
                        transfer: {
                            status: "RECEIVED",
                            destinationBranch: {
                                isActive: true,
                                userAssignments: {
                                    some: {
                                        userId: actor.id,
                                        isActive: true,
                                    },
                                },
                            },
                        },
                    },
                    select: {
                        id: true,
                        quantity: true,
                        quantityTransferred: true,
                        sellingPrice: true,
                        saleAllocations: {
                            select: {
                                quantity: true,
                            },
                        },
                        product: {
                            select: {
                                name: true,
                            },
                        },
                        transfer: {
                            select: {
                                transferNumber: true,
                                destinationBranchId: true,
                            },
                        },
                    },
                }),
            ]);
            if (!purchaseBatch && !transferBatch) {
                throw new Error("Selected batch was not found.");
            }
            const batch = purchaseBatch ?? transferBatch;
            if (!batch) {
                throw new Error("Selected batch was not found.");
            }
            const soldQuantity = batch.saleAllocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
            const remainingQuantity = batch.quantity - soldQuantity - batch.quantityTransferred;
            if (remainingQuantity <= 0) {
                throw new Error("Finished batches cannot be updated.");
            }
            if (purchaseBatch) {
                await tx.purchaseItem.update({
                    where: {
                        id: batch.id,
                    },
                    data: {
                        sellingPrice: toDecimal(parsed.data.sellingPrice),
                    },
                });
            }
            else {
                await tx.transferItem.update({
                    where: {
                        id: batch.id,
                    },
                    data: {
                        sellingPrice: toDecimal(parsed.data.sellingPrice),
                    },
                });
            }
            const auditInput = {
                actorUserId: actor.id,
                action: "OWNED_BATCH_PRICE_UPDATE",
                entityType: purchaseBatch ? "PurchaseItem" : "TransferItem",
                entityId: batch.id,
                before: {
                    sellingPrice: Number(batch.sellingPrice),
                    remainingQuantity,
                },
                after: {
                    sellingPrice: parsed.data.sellingPrice,
                    remainingQuantity,
                    referenceNumber: purchaseBatch
                        ? purchaseBatch.purchase.purchaseNumber
                        : transferBatch?.transfer.transferNumber,
                    productName: batch.product.name,
                },
            };
            const auditBranchId = purchaseBatch?.purchase.branchId ?? transferBatch?.transfer.destinationBranchId;
            await createAuditLog(tx, auditBranchId
                ? { ...auditInput, branchId: auditBranchId }
                : auditInput);
            return {
                productName: batch.product.name,
                referenceNumber: purchaseBatch
                    ? purchaseBatch.purchase.purchaseNumber
                    : transferBatch?.transfer.transferNumber ?? "batch",
            };
        });
        revalidatePath("/inventory/stock-overview");
        revalidatePath("/sales/new");
        revalidatePath("/dashboard");
        return {
            success: true,
            message: `${batchReference.productName} batch ${batchReference.referenceNumber} updated successfully.`,
        };
    }
    catch (error) {
        return {
            success: false,
            message: getActionErrorMessage(error, "Unable to update the batch price right now."),
        };
    }
}
