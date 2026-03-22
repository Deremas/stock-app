import type { Prisma } from "@/generated/prisma/client";

type TransactionClient = Prisma.TransactionClient;

type SnapshotInput = {
  branchId: string;
  productId: string;
  ownershipType: "OWNED" | "SELLER_CONSIGNMENT" | "SELLER_ASSIGNED";
  snapshotDate: Date;
  sourceKey?: string;
};

type AlertInput = {
  branchId: string;
  productId: string;
  threshold: number;
  evaluatedAt: Date;
};

type AuditInput = {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  branchId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

export async function createStockSnapshot(
  tx: TransactionClient,
  input: SnapshotInput,
) {
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

export async function syncLowStockAlert(
  tx: TransactionClient,
  input: AlertInput,
) {
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
    } else {
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
  } else if (existingAlert) {
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

export async function createAuditLog(tx: TransactionClient, input: AuditInput) {
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
