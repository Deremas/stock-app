"use server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { StockMovementType, StockOwnershipType, } from "@/generated/prisma/enums";
import { createDocumentNumber, getActionActorByPermission, getActionErrorMessage, normalizeOptionalString, parseInputDate, toDecimal, } from "@/lib/actions/common";
import { prisma } from "@/lib/prisma";
import { createAuditLog, createStockSnapshot, syncLowStockAlert, } from "@/lib/services/inventory-ledger";
import { sellerIntakeSchema, } from "@/lib/validation/seller";
function createPartnerItemSku(itemName) {
    const base = itemName
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 12);
    return `PTN-${base || "ITEM"}-${randomUUID().slice(0, 6).toUpperCase()}`;
}
export async function createSellerIntakeAction(input) {
    const actor = await getActionActorByPermission("sellers:manage");
    if (!actor) {
        return {
            success: false,
            message: "You are not allowed to record received partner items.",
        };
    }
    const parsed = sellerIntakeSchema.safeParse(input);
    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Received items payload did not validate.",
        };
    }
    const bringingDate = parseInputDate(parsed.data.bringingDate);
    if (!bringingDate) {
        return {
            success: false,
            message: "Bringing date is invalid.",
        };
    }
    const note = normalizeOptionalString(parsed.data.note);
    try {
        const intakeReference = await prisma.$transaction(async (tx) => {
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
                select: { id: true },
            });
            if (!seller) {
                throw new Error("Selected seller was not found.");
            }
            const intakeNumber = createDocumentNumber("INT", bringingDate);
            const intake = await tx.sellerIntake.create({
                data: {
                    intakeNumber,
                    sellerId: seller.id,
                    branchId: branch.id,
                    createdById: actor.id,
                    bringingDate,
                    ...(note ? { note } : {}),
                },
                select: {
                    id: true,
                    intakeNumber: true,
                },
            });
            const productCache = new Map();
            for (const item of parsed.data.items) {
                const normalizedName = item.itemName.trim().toLowerCase();
                let product = productCache.get(normalizedName);
                if (!product) {
                    const existingProduct = await tx.product.findFirst({
                        where: {
                            name: {
                                equals: item.itemName.trim(),
                                mode: "insensitive",
                            },
                        },
                        select: {
                            id: true,
                            minimumStockAlert: true,
                        },
                    });
                    if (existingProduct) {
                        product = existingProduct;
                    }
                    else {
                        product = await tx.product.create({
                            data: {
                                name: item.itemName.trim(),
                                sku: createPartnerItemSku(item.itemName),
                                minimumStockAlert: 0,
                                unit: "pcs",
                            },
                            select: {
                                id: true,
                                minimumStockAlert: true,
                            },
                        });
                    }
                    productCache.set(normalizedName, product);
                }
                const intakeItem = await tx.sellerIntakeItem.create({
                    data: {
                        sellerIntakeId: intake.id,
                        productId: product.id,
                        quantityBrought: item.quantityBrought,
                        sellerFixedPrice: toDecimal(item.sellerFixedPrice),
                        bringingDate,
                    },
                    select: {
                        id: true,
                    },
                });
                await tx.stockMovement.create({
                    data: {
                        branchId: branch.id,
                        productId: product.id,
                        movementType: StockMovementType.SELLER_INTAKE,
                        ownershipType: StockOwnershipType.SELLER_CONSIGNMENT,
                        quantity: item.quantityBrought,
                        unitCost: toDecimal(item.sellerFixedPrice),
                        movementDate: bringingDate,
                        sourceType: "SellerIntake",
                        sourceId: intake.id,
                        sourceLineId: intakeItem.id,
                        counterpartyType: "Seller",
                        counterpartyId: seller.id,
                    },
                });
                await createStockSnapshot(tx, {
                    branchId: branch.id,
                    productId: product.id,
                    ownershipType: StockOwnershipType.SELLER_CONSIGNMENT,
                    snapshotDate: bringingDate,
                    sourceKey: intake.intakeNumber,
                });
                await syncLowStockAlert(tx, {
                    branchId: branch.id,
                    productId: product.id,
                    threshold: product.minimumStockAlert,
                    evaluatedAt: bringingDate,
                });
            }
            await createAuditLog(tx, {
                actorUserId: actor.id,
                action: "SELLER_INTAKE_CREATE",
                entityType: "SellerIntake",
                entityId: intake.id,
                branchId: branch.id,
                after: {
                    intakeNumber: intake.intakeNumber,
                    sellerId: seller.id,
                    itemCount: parsed.data.items.length,
                },
            });
            return intake.intakeNumber;
        });
        revalidatePath("/sellers/list");
        revalidatePath("/sellers/intake-records");
        revalidatePath("/sellers/new-intake");
        revalidatePath("/reports/sellers");
        revalidatePath("/inventory/stock-overview");
        revalidatePath("/inventory/stock-movements");
        revalidatePath("/inventory/low-stock");
        revalidatePath("/inventory/out-of-stock");
        revalidatePath("/inventory/alert-records");
        revalidatePath("/dashboard");
        revalidatePath("/sales/daily-check");
        return {
            success: true,
            message: `Received items ${intakeReference} posted successfully.`,
        };
    }
    catch (error) {
        return {
            success: false,
            message: getActionErrorMessage(error, "Unable to post the received items right now."),
        };
    }
}
