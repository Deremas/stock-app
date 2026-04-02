"use server";
import { revalidatePath } from "next/cache";
import { getActionActorByPermission, getActionErrorMessage, normalizeOptionalString, } from "@/lib/actions/common";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/inventory-ledger";
import { productDeleteSchema, productUpdateSchema, productSchema, } from "@/lib/validation/product";
function buildItemSkuSeed(name) {
    const seed = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return seed.slice(0, 6) || "ITEM";
}
async function generateUniqueItemSku(tx, name) {
    const base = buildItemSkuSeed(name);
    while (true) {
        const candidate = `ITM-${base}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
        const existing = await tx.product.findUnique({
            where: { sku: candidate },
            select: { id: true },
        });
        if (!existing) {
            return candidate;
        }
    }
}
export async function createProductAction(input) {
    const actor = await getActionActorByPermission("inventory:manage");
    if (!actor) {
        return {
            success: false,
            message: "You are not allowed to create items.",
        };
    }
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Item details are invalid.",
        };
    }
    const name = parsed.data.name.trim();
    const unit = parsed.data.unit.trim() || "pcs";
    const description = normalizeOptionalString(parsed.data.description);
    try {
        const itemName = await prisma.$transaction(async (tx) => {
            const existing = await tx.product.findFirst({
                where: {
                    name: {
                        equals: name,
                        mode: "insensitive",
                    },
                },
                select: {
                    id: true,
                },
            });
            if (existing) {
                throw new Error("An item with that name already exists.");
            }
            const sku = await generateUniqueItemSku(tx, name);
            const product = await tx.product.create({
                data: {
                    name,
                    sku,
                    unit,
                    minimumStockAlert: parsed.data.minimumStockAlert,
                    ...(description ? { description } : {}),
                    isActive: true,
                },
                select: {
                    id: true,
                    name: true,
                    unit: true,
                    minimumStockAlert: true,
                },
            });
            await createAuditLog(tx, {
                actorUserId: actor.id,
                action: "PRODUCT_CREATE",
                entityType: "Product",
                entityId: product.id,
                after: {
                    name: product.name,
                    unit: product.unit,
                    minimumStockAlert: product.minimumStockAlert,
                },
            });
            return product.name;
        });
        revalidatePath("/inventory/products");
        revalidatePath("/inventory/stock-overview");
        revalidatePath("/inventory/low-stock");
        revalidatePath("/inventory/out-of-stock");
        revalidatePath("/dashboard");
        return {
            success: true,
            message: `${itemName} created successfully.`,
        };
    }
    catch (error) {
        return {
            success: false,
            message: getActionErrorMessage(error, "Unable to create the item right now."),
        };
    }
}
export async function updateProductAction(input) {
    const actor = await getActionActorByPermission("inventory:manage");
    if (!actor) {
        return {
            success: false,
            message: "You are not allowed to update items.",
        };
    }
    const parsed = productUpdateSchema.safeParse(input);
    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Item details are invalid.",
        };
    }
    const name = parsed.data.name.trim();
    const unit = parsed.data.unit.trim() || "pcs";
    const description = normalizeOptionalString(parsed.data.description);
    try {
        const itemName = await prisma.$transaction(async (tx) => {
            const product = await tx.product.findUnique({
                where: {
                    id: parsed.data.id,
                },
                select: {
                    id: true,
                    name: true,
                },
            });
            if (!product) {
                throw new Error("Selected item was not found.");
            }
            const conflicting = await tx.product.findFirst({
                where: {
                    id: {
                        not: product.id,
                    },
                    name: {
                        equals: name,
                        mode: "insensitive",
                    },
                },
                select: {
                    id: true,
                },
            });
            if (conflicting) {
                throw new Error("Another item with that name already exists.");
            }
            const updated = await tx.product.update({
                where: {
                    id: product.id,
                },
                data: {
                    name,
                    unit,
                    minimumStockAlert: parsed.data.minimumStockAlert,
                    description: description ?? null,
                },
                select: {
                    id: true,
                    name: true,
                    unit: true,
                    minimumStockAlert: true,
                },
            });
            await createAuditLog(tx, {
                actorUserId: actor.id,
                action: "PRODUCT_UPDATE",
                entityType: "Product",
                entityId: updated.id,
                after: {
                    name: updated.name,
                    unit: updated.unit,
                    minimumStockAlert: updated.minimumStockAlert,
                },
            });
            return updated.name;
        });
        revalidatePath("/inventory/products");
        revalidatePath("/inventory/stock-overview");
        revalidatePath("/inventory/low-stock");
        revalidatePath("/inventory/out-of-stock");
        revalidatePath("/sales/new");
        revalidatePath("/sales/sales-list");
        revalidatePath("/purchases/new");
        revalidatePath("/purchases/list");
        revalidatePath("/dashboard");
        return {
            success: true,
            message: `${itemName} updated successfully.`,
        };
    }
    catch (error) {
        return {
            success: false,
            message: getActionErrorMessage(error, "Unable to update the item right now."),
        };
    }
}
export async function deleteProductAction(input) {
    const actor = await getActionActorByPermission("admin:manage");
    if (!actor) {
        return {
            success: false,
            message: "You are not allowed to delete items.",
        };
    }
    const parsed = productDeleteSchema.safeParse(input);
    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Item details are invalid.",
        };
    }
    try {
        const itemName = await prisma.$transaction(async (tx) => {
            const product = await tx.product.findUnique({
                where: {
                    id: parsed.data.id,
                },
                select: {
                    id: true,
                    name: true,
                    sku: true,
                    _count: {
                        select: {
                            purchaseItems: true,
                            saleItems: true,
                            intakeItems: true,
                            assignmentItems: true,
                            returnItems: true,
                            transferItems: true,
                            stockMovements: true,
                            stockSnapshots: true,
                            alertRecords: true,
                        },
                    },
                },
            });
            if (!product) {
                throw new Error("Selected item was not found.");
            }
            const usageCount = Object.values(product._count).reduce((total, count) => total + count, 0);
            if (usageCount > 0) {
                throw new Error("You cannot delete an item that already has stock records or transaction history.");
            }
            await tx.product.delete({
                where: {
                    id: product.id,
                },
            });
            await createAuditLog(tx, {
                actorUserId: actor.id,
                action: "PRODUCT_DELETE",
                entityType: "Product",
                entityId: product.id,
                before: {
                    name: product.name,
                    sku: product.sku,
                },
            });
            return product.name;
        });
        revalidatePath("/inventory/products");
        revalidatePath("/inventory/stock-overview");
        revalidatePath("/inventory/low-stock");
        revalidatePath("/inventory/out-of-stock");
        revalidatePath("/sales/new");
        revalidatePath("/sales/sales-list");
        revalidatePath("/purchases/new");
        revalidatePath("/purchases/list");
        revalidatePath("/dashboard");
        return {
            success: true,
            message: `${itemName} deleted successfully.`,
        };
    }
    catch (error) {
        return {
            success: false,
            message: getActionErrorMessage(error, "Unable to delete the item right now."),
        };
    }
}
