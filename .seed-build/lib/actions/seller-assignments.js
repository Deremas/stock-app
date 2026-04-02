"use server";
import { revalidatePath } from "next/cache";
import { StockMovementType, StockOwnershipType } from "@/generated/prisma/enums";
import { createDocumentNumber, getActionActorByPermission, getActionErrorMessage, normalizeOptionalString, parseInputDate, toDecimal, } from "@/lib/actions/common";
import { prisma } from "@/lib/prisma";
import { createAuditLog, createStockSnapshot, syncLowStockAlert, } from "@/lib/services/inventory-ledger";
import { sellerAssignmentSchema, } from "@/lib/validation/seller-assignment";
async function getSellerAssignmentSourceBatch(args) {
    const [purchaseBatch, transferBatch] = await Promise.all([
        args.tx.purchaseItem.findFirst({
            where: {
                id: args.batchId,
                purchase: {
                    branchId: args.branchId,
                    status: "POSTED",
                },
            },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        minimumStockAlert: true,
                    },
                },
                saleAllocations: {
                    select: {
                        quantity: true,
                    },
                },
                purchase: {
                    select: {
                        branchId: true,
                        purchaseNumber: true,
                        supplier: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        }),
        args.tx.transferItem.findFirst({
            where: {
                id: args.batchId,
                transfer: {
                    destinationBranchId: args.branchId,
                    status: "RECEIVED",
                },
            },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        minimumStockAlert: true,
                    },
                },
                saleAllocations: {
                    select: {
                        quantity: true,
                    },
                },
                transfer: {
                    select: {
                        destinationBranchId: true,
                        transferNumber: true,
                        sourceBranch: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        }),
    ]);
    if (purchaseBatch) {
        return {
            id: purchaseBatch.id,
            kind: "purchase",
            productId: purchaseBatch.product.id,
            productName: purchaseBatch.product.name,
            branchId: purchaseBatch.purchase.branchId,
            quantity: purchaseBatch.quantity,
            quantityTransferred: purchaseBatch.quantityTransferred,
            soldQuantity: purchaseBatch.saleAllocations.reduce((sum, allocation) => sum + allocation.quantity, 0),
            unitCost: Number(purchaseBatch.unitCost),
            currentSellingPrice: Number(purchaseBatch.sellingPrice),
            referenceNumber: purchaseBatch.purchase.purchaseNumber,
            sourceName: purchaseBatch.purchase.supplier?.name ?? "No supplier",
        };
    }
    if (transferBatch) {
        return {
            id: transferBatch.id,
            kind: "transfer",
            productId: transferBatch.product.id,
            productName: transferBatch.product.name,
            branchId: transferBatch.transfer.destinationBranchId,
            quantity: transferBatch.quantity,
            quantityTransferred: transferBatch.quantityTransferred,
            soldQuantity: transferBatch.saleAllocations.reduce((sum, allocation) => sum + allocation.quantity, 0),
            unitCost: Number(transferBatch.unitCost ?? 0),
            currentSellingPrice: Number(transferBatch.sellingPrice),
            referenceNumber: transferBatch.transfer.transferNumber,
            sourceName: transferBatch.transfer.sourceBranch.name,
        };
    }
    throw new Error("Selected batch is no longer available.");
}
export async function createSellerAssignmentAction(input) {
    const actor = await getActionActorByPermission("sellers:manage");
    if (!actor) {
        return {
            success: false,
            message: "You are not allowed to assign items to sellers.",
        };
    }
    const parsed = sellerAssignmentSchema.safeParse(input);
    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Seller assignment payload did not validate.",
        };
    }
    const assignmentDate = parseInputDate(parsed.data.assignmentDate);
    if (!assignmentDate) {
        return {
            success: false,
            message: "Assignment date is invalid.",
        };
    }
    const note = normalizeOptionalString(parsed.data.note);
    try {
        const assignmentReference = await prisma.$transaction(async (tx) => {
            const branch = await tx.branch.findFirst({
                where: {
                    id: parsed.data.branchId,
                    isActive: true,
                    userAssignments: {
                        some: {
                            userId: actor.id,
                            isActive: true,
                        },
                    },
                },
                select: { id: true },
            });
            if (!branch) {
                throw new Error("You do not have access to the selected branch.");
            }
            const seller = await tx.seller.findUnique({
                where: { id: parsed.data.sellerId },
                select: {
                    id: true,
                    fullName: true,
                },
            });
            if (!seller) {
                throw new Error("Selected seller was not found.");
            }
            const assignmentNumber = createDocumentNumber("ASN", assignmentDate);
            const assignment = await tx.sellerAssignment.create({
                data: {
                    assignmentNumber,
                    sellerId: seller.id,
                    branchId: branch.id,
                    createdById: actor.id,
                    assignmentDate,
                    ...(note ? { note } : {}),
                },
                select: {
                    id: true,
                    assignmentNumber: true,
                },
            });
            for (const item of parsed.data.items) {
                const sourceBatch = await getSellerAssignmentSourceBatch({
                    tx,
                    batchId: item.ownedBatchId,
                    branchId: branch.id,
                });
                const remainingQuantity = sourceBatch.quantity -
                    sourceBatch.soldQuantity -
                    sourceBatch.quantityTransferred;
                if (remainingQuantity < item.quantityAssigned) {
                    throw new Error(`${sourceBatch.productName} has only ${remainingQuantity} item(s) left in the selected batch.`);
                }
                const assignmentItem = await tx.sellerAssignmentItem.create({
                    data: {
                        sellerAssignmentId: assignment.id,
                        ...(sourceBatch.kind === "purchase"
                            ? { purchaseItemId: sourceBatch.id }
                            : { transferItemId: sourceBatch.id }),
                        productId: sourceBatch.productId,
                        quantityAssigned: item.quantityAssigned,
                        unitCost: toDecimal(sourceBatch.unitCost),
                        sellingPrice: toDecimal(item.sellingPrice),
                        assignmentDate,
                    },
                    select: {
                        id: true,
                    },
                });
                if (sourceBatch.kind === "purchase") {
                    await tx.purchaseItem.update({
                        where: {
                            id: sourceBatch.id,
                        },
                        data: {
                            quantityTransferred: {
                                increment: item.quantityAssigned,
                            },
                        },
                    });
                }
                else {
                    await tx.transferItem.update({
                        where: {
                            id: sourceBatch.id,
                        },
                        data: {
                            quantityTransferred: {
                                increment: item.quantityAssigned,
                            },
                        },
                    });
                }
                await tx.stockMovement.createMany({
                    data: [
                        {
                            branchId: branch.id,
                            productId: sourceBatch.productId,
                            movementType: StockMovementType.SELLER_ASSIGNMENT,
                            ownershipType: StockOwnershipType.OWNED,
                            quantity: -item.quantityAssigned,
                            unitCost: toDecimal(sourceBatch.unitCost),
                            unitValue: toDecimal(item.sellingPrice),
                            movementDate: assignmentDate,
                            sourceType: "SellerAssignment",
                            sourceId: assignment.id,
                            sourceLineId: assignmentItem.id,
                            counterpartyType: "Seller",
                            counterpartyId: seller.id,
                        },
                        {
                            branchId: branch.id,
                            productId: sourceBatch.productId,
                            movementType: StockMovementType.SELLER_ASSIGNMENT,
                            ownershipType: StockOwnershipType.SELLER_ASSIGNED,
                            quantity: item.quantityAssigned,
                            unitCost: toDecimal(sourceBatch.unitCost),
                            unitValue: toDecimal(item.sellingPrice),
                            movementDate: assignmentDate,
                            sourceType: "SellerAssignment",
                            sourceId: assignment.id,
                            sourceLineId: assignmentItem.id,
                            counterpartyType: "Seller",
                            counterpartyId: seller.id,
                        },
                    ],
                });
                await createStockSnapshot(tx, {
                    branchId: branch.id,
                    productId: sourceBatch.productId,
                    ownershipType: StockOwnershipType.OWNED,
                    snapshotDate: assignmentDate,
                    sourceKey: assignment.assignmentNumber,
                });
                await createStockSnapshot(tx, {
                    branchId: branch.id,
                    productId: sourceBatch.productId,
                    ownershipType: StockOwnershipType.SELLER_ASSIGNED,
                    snapshotDate: assignmentDate,
                    sourceKey: assignment.assignmentNumber,
                });
                const product = await tx.product.findUnique({
                    where: { id: sourceBatch.productId },
                    select: {
                        minimumStockAlert: true,
                    },
                });
                await syncLowStockAlert(tx, {
                    branchId: branch.id,
                    productId: sourceBatch.productId,
                    threshold: product?.minimumStockAlert ?? 0,
                    evaluatedAt: assignmentDate,
                });
            }
            await createAuditLog(tx, {
                actorUserId: actor.id,
                action: "SELLER_ASSIGNMENT_CREATE",
                entityType: "SellerAssignment",
                entityId: assignment.id,
                branchId: branch.id,
                after: {
                    assignmentNumber: assignment.assignmentNumber,
                    sellerId: seller.id,
                    itemCount: parsed.data.items.length,
                },
            });
            return assignment.assignmentNumber;
        });
        revalidatePath("/sellers/assign-items");
        revalidatePath("/sellers/list");
        revalidatePath("/sellers/assigned-items");
        revalidatePath("/reports/sellers");
        revalidatePath("/inventory/stock-overview");
        revalidatePath("/inventory/stock-movements");
        revalidatePath("/inventory/low-stock");
        revalidatePath("/inventory/out-of-stock");
        revalidatePath("/inventory/alert-records");
        revalidatePath("/sales/new");
        revalidatePath("/dashboard");
        return {
            success: true,
            message: `Seller assignment ${assignmentReference} posted successfully.`,
        };
    }
    catch (error) {
        return {
            success: false,
            message: getActionErrorMessage(error, "Unable to post the seller assignment right now."),
        };
    }
}
