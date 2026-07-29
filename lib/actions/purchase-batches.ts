"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  InventoryAdjustmentType,
  StockMovementType,
  StockOwnershipType,
} from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/actions/common";
import {
  getActionActorByPermission,
  getActionErrorMessage,
  toDecimal,
} from "@/lib/actions/common";
import { calculateBatchQuantityAdjustment } from "@/lib/inventory-adjustments";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { createAuditLog } from "@/lib/services/inventory-ledger";

const ownedBatchAdjustmentSchema = z.object({
  batchId: z.string().min(1, "Batch is required."),
  unitCost: z.coerce.number().nonnegative("Buying price must be zero or more."),
  sellingPrice: z.coerce
    .number()
    .nonnegative("Selling price must be zero or more."),
  quantityDelta: z.coerce
    .number()
    .int("Quantity adjustment must be a whole number."),
  reason: z
    .string()
    .trim()
    .min(3, "Enter a reason for this adjustment.")
    .max(500, "Adjustment reason is too long."),
});

export type OwnedBatchAdjustmentInput = z.input<
  typeof ownedBatchAdjustmentSchema
>;

export async function adjustOwnedStockBatchAction(
  input: OwnedBatchAdjustmentInput,
): Promise<ActionResult> {
  const actor = await getActionActorByPermission("inventory:manage");

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to adjust inventory.",
    };
  }

  const parsed = ownedBatchAdjustmentSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ?? "Inventory adjustment is invalid.",
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const restrictToAssignedBranches = !hasPermission(
        actor.role,
        "branch:view-all",
      );
      const assignmentFilter = restrictToAssignedBranches
        ? {
            userAssignments: {
              some: {
                userId: actor.id,
                isActive: true,
              },
            },
          }
        : {};

      const [purchaseBatch, transferBatch] = await Promise.all([
        tx.purchaseItem.findFirst({
          where: {
            id: parsed.data.batchId,
            purchase: {
              status: "POSTED",
              branch: {
                isActive: true,
                ...assignmentFilter,
              },
            },
          },
          select: {
            id: true,
            productId: true,
            quantity: true,
            quantityAdjustment: true,
            quantityTransferred: true,
            unitCost: true,
            sellingPrice: true,
            saleAllocations: { select: { quantity: true } },
            product: { select: { name: true } },
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
                ...assignmentFilter,
              },
            },
          },
          select: {
            id: true,
            productId: true,
            quantity: true,
            quantityAdjustment: true,
            quantityTransferred: true,
            unitCost: true,
            sellingPrice: true,
            saleAllocations: { select: { quantity: true } },
            product: { select: { name: true } },
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
        throw new Error("Selected inventory batch was not found.");
      }

      const batch = purchaseBatch ?? transferBatch;

      if (!batch) {
        throw new Error("Selected inventory batch was not found.");
      }

      const soldQuantity = batch.saleAllocations.reduce(
        (sum, allocation) => sum + allocation.quantity,
        0,
      );
      const {
        adjustedQuantityBefore,
        adjustedQuantityAfter,
        remainingBefore,
        remainingAfter,
      } = calculateBatchQuantityAdjustment({
        originalQuantity: batch.quantity,
        existingAdjustment: batch.quantityAdjustment,
        soldQuantity,
        transferredQuantity: batch.quantityTransferred,
        quantityDelta: parsed.data.quantityDelta,
      });

      const currentUnitCost = Number(batch.unitCost ?? 0);
      const currentSellingPrice = Number(batch.sellingPrice);
      const unitCostChanged = parsed.data.unitCost !== currentUnitCost;
      const sellingPriceChanged =
        parsed.data.sellingPrice !== currentSellingPrice;
      const quantityChanged = parsed.data.quantityDelta !== 0;

      if (!unitCostChanged && !sellingPriceChanged && !quantityChanged) {
        throw new Error("Enter at least one changed price or quantity.");
      }

      const branchId = purchaseBatch
        ? purchaseBatch.purchase.branchId
        : transferBatch!.transfer.destinationBranchId;
      const referenceNumber = purchaseBatch
        ? purchaseBatch.purchase.purchaseNumber
        : transferBatch!.transfer.transferNumber;
      const batchType = purchaseBatch ? "PURCHASE" : "TRANSFER";

      const updateData = {
        unitCost: toDecimal(parsed.data.unitCost),
        sellingPrice: toDecimal(parsed.data.sellingPrice),
        quantityAdjustment:
          batch.quantityAdjustment + parsed.data.quantityDelta,
      };

      if (purchaseBatch) {
        await tx.purchaseItem.update({
          where: { id: batch.id },
          data: updateData,
        });
      } else {
        await tx.transferItem.update({
          where: { id: batch.id },
          data: updateData,
        });
      }

      const commonAdjustmentData = {
        batchId: batch.id,
        batchType,
        referenceNumber,
        productId: batch.productId,
        branchId,
        actorUserId: actor.id,
        reason: parsed.data.reason,
      };

      if (unitCostChanged) {
        await tx.inventoryAdjustment.create({
          data: {
            ...commonAdjustmentData,
            adjustmentType: InventoryAdjustmentType.PURCHASE_PRICE,
            previousValue: toDecimal(currentUnitCost),
            newValue: toDecimal(parsed.data.unitCost),
          },
        });
      }

      if (sellingPriceChanged) {
        await tx.inventoryAdjustment.create({
          data: {
            ...commonAdjustmentData,
            adjustmentType: InventoryAdjustmentType.SELLING_PRICE,
            previousValue: toDecimal(currentSellingPrice),
            newValue: toDecimal(parsed.data.sellingPrice),
          },
        });
      }

      if (quantityChanged) {
        const quantityAdjustment = await tx.inventoryAdjustment.create({
          data: {
            ...commonAdjustmentData,
            adjustmentType: InventoryAdjustmentType.QUANTITY,
            previousValue: toDecimal(adjustedQuantityBefore),
            newValue: toDecimal(adjustedQuantityAfter),
            quantityDelta: parsed.data.quantityDelta,
          },
          select: { id: true },
        });

        await tx.stockMovement.create({
          data: {
            branchId,
            productId: batch.productId,
            movementType: StockMovementType.ADJUSTMENT,
            ownershipType: StockOwnershipType.OWNED,
            quantity: parsed.data.quantityDelta,
            unitCost: toDecimal(parsed.data.unitCost),
            unitValue: toDecimal(parsed.data.sellingPrice),
            movementDate: new Date(),
            sourceType: "InventoryAdjustment",
            sourceId: quantityAdjustment.id,
            sourceLineId: batch.id,
          },
        });
      }

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: "OWNED_BATCH_ADJUST",
        entityType: batchType === "PURCHASE" ? "PurchaseItem" : "TransferItem",
        entityId: batch.id,
        branchId,
        before: {
          unitCost: currentUnitCost,
          sellingPrice: currentSellingPrice,
          adjustedQuantity: adjustedQuantityBefore,
          remainingQuantity: remainingBefore,
        },
        after: {
          unitCost: parsed.data.unitCost,
          sellingPrice: parsed.data.sellingPrice,
          adjustedQuantity: adjustedQuantityAfter,
          remainingQuantity: remainingAfter,
          quantityDelta: parsed.data.quantityDelta,
          reason: parsed.data.reason,
        },
      });

      return {
        productName: batch.product.name,
        referenceNumber,
      };
    });

    revalidatePath("/inventory/stock");
    revalidatePath("/inventory/stock-movements");
    revalidatePath("/reports/inventory-adjustments");
    revalidatePath("/sales/new");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `${result.productName} batch ${result.referenceNumber} adjusted successfully.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(
        error,
        "Unable to adjust the inventory batch right now.",
      ),
    };
  }
}
