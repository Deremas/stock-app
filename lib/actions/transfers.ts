"use server";

import { revalidatePath } from "next/cache";

import { StockMovementType, StockOwnershipType, TransferStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";

import type { ActionResult } from "@/lib/actions/common";
import {
  createDocumentNumber,
  getActionActor,
  getActionErrorMessage,
  normalizeOptionalString,
  parseInputDate,
  toDecimal,
} from "@/lib/actions/common";
import { prisma } from "@/lib/prisma";
import {
  createAuditLog,
  createStockSnapshot,
  syncLowStockAlert,
} from "@/lib/services/inventory-ledger";
import { transferSchema, type TransferFormInput } from "@/lib/validation/transfer";

type TransferSourceBatch = {
  id: string;
  kind: "purchase" | "transfer";
  productId: string;
  productName: string;
  sourceBranchId: string;
  quantity: number;
  quantityTransferred: number;
  soldQuantity: number;
  unitCost: number;
  sellingPrice: number;
};

async function getTransferSourceBatch(args: {
  tx: Prisma.TransactionClient;
  batchId: string;
  sourceBranchId: string;
  productId: string;
}): Promise<TransferSourceBatch> {
  const [purchaseBatch, transferBatch] = await Promise.all([
    args.tx.purchaseItem.findFirst({
      where: {
        id: args.batchId,
        productId: args.productId,
        purchase: {
          branchId: args.sourceBranchId,
          status: "POSTED",
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
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
          },
        },
      },
    }),
    args.tx.transferItem.findFirst({
      where: {
        id: args.batchId,
        productId: args.productId,
        transfer: {
          destinationBranchId: args.sourceBranchId,
          status: "RECEIVED",
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
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
      sourceBranchId: purchaseBatch.purchase.branchId,
      quantity: purchaseBatch.quantity,
      quantityTransferred: purchaseBatch.quantityTransferred,
      soldQuantity: purchaseBatch.saleAllocations.reduce(
        (sum, allocation) => sum + allocation.quantity,
        0,
      ),
      unitCost: Number(purchaseBatch.unitCost),
      sellingPrice: Number(purchaseBatch.sellingPrice),
    };
  }

  if (transferBatch) {
    return {
      id: transferBatch.id,
      kind: "transfer",
      productId: transferBatch.product.id,
      productName: transferBatch.product.name,
      sourceBranchId: transferBatch.transfer.destinationBranchId,
      quantity: transferBatch.quantity,
      quantityTransferred: transferBatch.quantityTransferred,
      soldQuantity: transferBatch.saleAllocations.reduce(
        (sum, allocation) => sum + allocation.quantity,
        0,
      ),
      unitCost: Number(transferBatch.unitCost ?? 0),
      sellingPrice: Number(transferBatch.sellingPrice),
    };
  }

  throw new Error("Selected source batch is no longer available.");
}

export async function createTransferAction(
  input: TransferFormInput,
): Promise<ActionResult> {
  const actor = await getActionActor(["ADMIN", "SALES"]);

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to create transfers.",
    };
  }

  const parsed = transferSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ?? "Transfer payload did not validate.",
    };
  }

  const transferAt = parseInputDate(parsed.data.transferAt);

  if (!transferAt) {
    return {
      success: false,
      message: "Transfer date is invalid.",
    };
  }

  const note = normalizeOptionalString(parsed.data.note);

  try {
    const transferReference = await prisma.$transaction(async (tx) => {
      const assignments = await tx.userBranch.findMany({
        where: {
          userId: actor.id,
          isActive: true,
          branchId: {
            in: [parsed.data.sourceBranchId, parsed.data.destinationBranchId],
          },
          branch: {
            isActive: true,
          },
        },
        select: {
          branchId: true,
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const sourceBranch = assignments.find(
        (assignment) => assignment.branchId === parsed.data.sourceBranchId,
      )?.branch;
      const destinationBranch = assignments.find(
        (assignment) => assignment.branchId === parsed.data.destinationBranchId,
      )?.branch;

      if (!sourceBranch || !destinationBranch) {
        throw new Error(
          "You must be assigned to both the source and destination branches.",
        );
      }

      const productIds = [...new Set(parsed.data.items.map((item) => item.productId))];
      const products = await tx.product.findMany({
        where: {
          id: {
            in: productIds,
          },
        },
        select: {
          id: true,
          name: true,
          minimumStockAlert: true,
        },
      });

      if (products.length !== productIds.length) {
        throw new Error("One or more selected items no longer exist.");
      }

      const productMap = new Map(products.map((product) => [product.id, product]));
      const transferNumber = createDocumentNumber("TRN", transferAt);

      const transfer = await tx.transfer.create({
        data: {
          transferNumber,
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          status: TransferStatus.RECEIVED,
          sentById: actor.id,
          receivedById: actor.id,
          sentAt: transferAt,
          receivedAt: transferAt,
          ...(note ? { note } : {}),
        },
        select: {
          id: true,
          transferNumber: true,
        },
      });

      for (const item of parsed.data.items) {
        const product = productMap.get(item.productId);

        if (!product) {
          throw new Error("Transfer line references an unknown item.");
        }

        const sourceBatch = await getTransferSourceBatch({
          tx,
          batchId: item.ownedBatchId,
          sourceBranchId: sourceBranch.id,
          productId: product.id,
        });
        const remainingQuantity =
          sourceBatch.quantity -
          sourceBatch.soldQuantity -
          sourceBatch.quantityTransferred;

        if (remainingQuantity < item.quantity) {
          throw new Error(
            `${sourceBatch.productName} does not have enough remaining quantity in the selected batch.`,
          );
        }

        const transferItem = await tx.transferItem.create({
          data: {
            transferId: transfer.id,
            productId: product.id,
            quantity: item.quantity,
            unitCost: toDecimal(sourceBatch.unitCost),
            sellingPrice: toDecimal(sourceBatch.sellingPrice),
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
                increment: item.quantity,
              },
            },
          });
        } else {
          await tx.transferItem.update({
            where: {
              id: sourceBatch.id,
            },
            data: {
              quantityTransferred: {
                increment: item.quantity,
              },
            },
          });
        }

        await tx.stockMovement.createMany({
          data: [
            {
              branchId: sourceBranch.id,
              productId: product.id,
              movementType: StockMovementType.TRANSFER_OUT,
              ownershipType: StockOwnershipType.OWNED,
              quantity: -item.quantity,
              unitCost: toDecimal(sourceBatch.unitCost),
              unitValue: toDecimal(sourceBatch.sellingPrice),
              movementDate: transferAt,
              sourceType: "Transfer",
              sourceId: transfer.id,
              sourceLineId: transferItem.id,
              counterpartyType: "Branch",
              counterpartyId: destinationBranch.id,
            },
            {
              branchId: destinationBranch.id,
              productId: product.id,
              movementType: StockMovementType.TRANSFER_IN,
              ownershipType: StockOwnershipType.OWNED,
              quantity: item.quantity,
              unitCost: toDecimal(sourceBatch.unitCost),
              unitValue: toDecimal(sourceBatch.sellingPrice),
              movementDate: transferAt,
              sourceType: "Transfer",
              sourceId: transfer.id,
              sourceLineId: transferItem.id,
              counterpartyType: "Branch",
              counterpartyId: sourceBranch.id,
            },
          ],
        });

        await createStockSnapshot(tx, {
          branchId: sourceBranch.id,
          productId: product.id,
          ownershipType: StockOwnershipType.OWNED,
          snapshotDate: transferAt,
          sourceKey: transfer.transferNumber,
        });

        await createStockSnapshot(tx, {
          branchId: destinationBranch.id,
          productId: product.id,
          ownershipType: StockOwnershipType.OWNED,
          snapshotDate: transferAt,
          sourceKey: transfer.transferNumber,
        });

        await syncLowStockAlert(tx, {
          branchId: sourceBranch.id,
          productId: product.id,
          threshold: product.minimumStockAlert,
          evaluatedAt: transferAt,
        });

        await syncLowStockAlert(tx, {
          branchId: destinationBranch.id,
          productId: product.id,
          threshold: product.minimumStockAlert,
          evaluatedAt: transferAt,
        });
      }

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: "TRANSFER_CREATE",
        entityType: "Transfer",
        entityId: transfer.id,
        branchId: sourceBranch.id,
        after: {
          transferNumber: transfer.transferNumber,
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          itemCount: parsed.data.items.length,
        },
      });

      return transfer.transferNumber;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    revalidatePath("/inventory/transfers");
    revalidatePath("/inventory/stock-overview");
    revalidatePath("/inventory/low-stock");
    revalidatePath("/inventory/out-of-stock");
    revalidatePath("/sales/new");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Transfer ${transferReference} posted successfully.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(
        error,
        "Unable to post the transfer right now.",
      ),
    };
  }
}
