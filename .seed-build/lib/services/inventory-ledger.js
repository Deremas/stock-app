export async function createStockSnapshot(tx, input) {
    const aggregate = await tx.stockMovement.aggregate({
        where: {
            branchId: input.branchId,
            productId: input.productId,
            ownershipType: input.ownershipType,
        },
        _sum: {
            quantity: true,
        },
    });
    const quantity = aggregate._sum.quantity ?? 0;
    await tx.stockBalanceSnapshot.create({
        data: {
            branchId: input.branchId,
            productId: input.productId,
            ownershipType: input.ownershipType,
            quantity,
            snapshotDate: input.snapshotDate,
            ...(input.sourceKey ? { sourceKey: input.sourceKey } : {}),
        },
    });
    return quantity;
}
export async function syncLowStockAlert(tx, input) {
    const aggregate = await tx.stockMovement.aggregate({
        where: {
            branchId: input.branchId,
            productId: input.productId,
        },
        _sum: {
            quantity: true,
        },
    });
    const totalQuantity = aggregate._sum.quantity ?? 0;
    const existingAlert = await tx.alertRecord.findFirst({
        where: {
            branchId: input.branchId,
            productId: input.productId,
            alertType: "LOW_STOCK",
            isResolved: false,
        },
        select: {
            id: true,
        },
    });
    if (totalQuantity <= input.threshold) {
        if (existingAlert) {
            await tx.alertRecord.update({
                where: {
                    id: existingAlert.id,
                },
                data: {
                    quantityAtAlert: totalQuantity,
                },
            });
        }
        else {
            await tx.alertRecord.create({
                data: {
                    branchId: input.branchId,
                    productId: input.productId,
                    alertType: "LOW_STOCK",
                    threshold: input.threshold,
                    quantityAtAlert: totalQuantity,
                },
            });
        }
    }
    else if (existingAlert) {
        await tx.alertRecord.update({
            where: {
                id: existingAlert.id,
            },
            data: {
                isResolved: true,
                resolvedAt: input.evaluatedAt,
            },
        });
    }
    return totalQuantity;
}
export async function createAuditLog(tx, input) {
    await tx.auditLog.create({
        data: {
            action: input.action,
            entityType: input.entityType,
            entityId: input.entityId,
            ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
            ...(input.branchId ? { branchId: input.branchId } : {}),
            ...(input.before ? { before: input.before } : {}),
            ...(input.after ? { after: input.after } : {}),
        },
    });
}
