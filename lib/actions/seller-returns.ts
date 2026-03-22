"use server";

import { revalidatePath } from "next/cache";

import { StockMovementType, StockOwnershipType } from "@/generated/prisma/enums";

import type { ActionResult } from "@/lib/actions/common";
import {
  createDocumentNumber,
  getActionActorByPermission,
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
import {
  sellerReturnSchema,
  type SellerReturnFormInput,
} from "@/lib/validation/seller-return";

type ParsedLineId =
  | {
      kind: "INTAKE";
      sourceId: string;
    }
  | {
      kind: "ASSIGNMENT";
      sourceId: string;
    };

function parseReturnLineId(lineId: string): ParsedLineId {
  const [kind, sourceId] = lineId.split(":");

  if ((kind !== "INTAKE" && kind !== "ASSIGNMENT") || !sourceId) {
    throw new Error("One of the selected return lines is invalid.");
  }

  return {
    kind,
    sourceId,
  };
}

export async function createSellerReturnAction(
  input: SellerReturnFormInput,
): Promise<ActionResult> {
  const actor = await getActionActorByPermission("sellers:manage");

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to record partner returns.",
    };
  }

  const parsed = sellerReturnSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ?? "Return details are invalid.",
    };
  }

  const returnDate = parseInputDate(parsed.data.returnDate);

  if (!returnDate) {
    return {
      success: false,
      message: "Return date is invalid.",
    };
  }

  const note = normalizeOptionalString(parsed.data.note);
  const selectedLineIds = parsed.data.items.map((item) => item.lineId);

  if (new Set(selectedLineIds).size !== selectedLineIds.length) {
    return {
      success: false,
      message: "Select each return line only once.",
    };
  }

  try {
    const returnReference = await prisma.$transaction(async (tx) => {
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
        select: {
          id: true,
          name: true,
        },
      });

      if (!branch) {
        throw new Error("You do not have access to the selected branch.");
      }

      const seller = await tx.seller.findUnique({
        where: {
          id: parsed.data.sellerId,
        },
        select: {
          id: true,
          fullName: true,
        },
      });

      if (!seller) {
        throw new Error("Selected partner was not found.");
      }

      const returnNumber = createDocumentNumber("RET", returnDate);
      const sellerReturn = await tx.sellerReturn.create({
        data: {
          returnNumber,
          sellerId: seller.id,
          branchId: branch.id,
          createdById: actor.id,
          returnDate,
          ...(note ? { note } : {}),
        },
        select: {
          id: true,
          returnNumber: true,
        },
      });

      for (const item of parsed.data.items) {
        const parsedLine = parseReturnLineId(item.lineId);

        if (parsedLine.kind === "INTAKE") {
          const intakeItem = await tx.sellerIntakeItem.findFirst({
            where: {
              id: parsedLine.sourceId,
              sellerIntake: {
                sellerId: seller.id,
                branchId: branch.id,
              },
            },
            select: {
              id: true,
              productId: true,
              quantityBrought: true,
              quantityAssigned: true,
              quantitySold: true,
              quantityReturned: true,
              sellerFixedPrice: true,
              product: {
                select: {
                  minimumStockAlert: true,
                  name: true,
                },
              },
            },
          });

          if (!intakeItem) {
            throw new Error("One selected received-item line was not found.");
          }

          const availableQty =
            intakeItem.quantityBrought -
            intakeItem.quantityAssigned -
            intakeItem.quantitySold -
            intakeItem.quantityReturned;

          if (availableQty < item.quantity) {
            throw new Error(
              `${intakeItem.product.name} has only ${availableQty} item(s) left to return to the partner.`,
            );
          }

          const returnItem = await tx.sellerReturnItem.create({
            data: {
              sellerReturnId: sellerReturn.id,
              sellerIntakeItemId: intakeItem.id,
              productId: intakeItem.productId,
              quantity: item.quantity,
            },
            select: {
              id: true,
            },
          });

          await tx.sellerIntakeItem.update({
            where: {
              id: intakeItem.id,
            },
            data: {
              quantityReturned: {
                increment: item.quantity,
              },
            },
          });

          await tx.stockMovement.create({
            data: {
              branchId: branch.id,
              productId: intakeItem.productId,
              movementType: StockMovementType.SELLER_RETURN,
              ownershipType: StockOwnershipType.SELLER_CONSIGNMENT,
              quantity: -item.quantity,
              unitCost: toDecimal(Number(intakeItem.sellerFixedPrice)),
              movementDate: returnDate,
              sourceType: "SellerReturn",
              sourceId: sellerReturn.id,
              sourceLineId: returnItem.id,
              counterpartyType: "Seller",
              counterpartyId: seller.id,
            },
          });

          await createStockSnapshot(tx, {
            branchId: branch.id,
            productId: intakeItem.productId,
            ownershipType: StockOwnershipType.SELLER_CONSIGNMENT,
            snapshotDate: returnDate,
            sourceKey: sellerReturn.returnNumber,
          });

          await syncLowStockAlert(tx, {
            branchId: branch.id,
            productId: intakeItem.productId,
            threshold: intakeItem.product.minimumStockAlert,
            evaluatedAt: returnDate,
          });

          continue;
        }

        const assignmentItem = await tx.sellerAssignmentItem.findFirst({
          where: {
            id: parsedLine.sourceId,
            sellerAssignment: {
              sellerId: seller.id,
              branchId: branch.id,
            },
          },
          select: {
            id: true,
            productId: true,
            quantityAssigned: true,
            quantitySold: true,
            quantityReturned: true,
            unitCost: true,
            purchaseItemId: true,
            transferItemId: true,
            sellerIntakeItemId: true,
            product: {
              select: {
                minimumStockAlert: true,
                name: true,
              },
            },
          },
        });

        if (!assignmentItem) {
          throw new Error("One selected assigned-item line was not found.");
        }

        const availableQty =
          assignmentItem.quantityAssigned -
          assignmentItem.quantitySold -
          assignmentItem.quantityReturned;

        if (availableQty < item.quantity) {
          throw new Error(
            `${assignmentItem.product.name} has only ${availableQty} item(s) left to return back into stock.`,
          );
        }

        const returnItem = await tx.sellerReturnItem.create({
          data: {
            sellerReturnId: sellerReturn.id,
            sellerAssignmentItemId: assignmentItem.id,
            productId: assignmentItem.productId,
            quantity: item.quantity,
          },
          select: {
            id: true,
          },
        });

        await tx.sellerAssignmentItem.update({
          where: {
            id: assignmentItem.id,
          },
          data: {
            quantityReturned: {
              increment: item.quantity,
            },
          },
        });

        if (assignmentItem.purchaseItemId) {
          await tx.purchaseItem.update({
            where: {
              id: assignmentItem.purchaseItemId,
            },
            data: {
              quantityTransferred: {
                decrement: item.quantity,
              },
            },
          });
        } else if (assignmentItem.transferItemId) {
          await tx.transferItem.update({
            where: {
              id: assignmentItem.transferItemId,
            },
            data: {
              quantityTransferred: {
                decrement: item.quantity,
              },
            },
          });
        } else if (assignmentItem.sellerIntakeItemId) {
          await tx.sellerIntakeItem.update({
            where: {
              id: assignmentItem.sellerIntakeItemId,
            },
            data: {
              quantityAssigned: {
                decrement: item.quantity,
              },
            },
          });
        } else {
          throw new Error("Assigned line is missing its source stock.");
        }

        const unitCost = Number(assignmentItem.unitCost ?? 0);
        const restoredOwnership = assignmentItem.sellerIntakeItemId
          ? StockOwnershipType.SELLER_CONSIGNMENT
          : StockOwnershipType.OWNED;

        await tx.stockMovement.createMany({
          data: [
            {
              branchId: branch.id,
              productId: assignmentItem.productId,
              movementType: StockMovementType.SELLER_RETURN,
              ownershipType: StockOwnershipType.SELLER_ASSIGNED,
              quantity: -item.quantity,
              unitCost: toDecimal(unitCost),
              movementDate: returnDate,
              sourceType: "SellerReturn",
              sourceId: sellerReturn.id,
              sourceLineId: returnItem.id,
              counterpartyType: "Seller",
              counterpartyId: seller.id,
            },
            {
              branchId: branch.id,
              productId: assignmentItem.productId,
              movementType: StockMovementType.SELLER_RETURN,
              ownershipType: restoredOwnership,
              quantity: item.quantity,
              unitCost: toDecimal(unitCost),
              movementDate: returnDate,
              sourceType: "SellerReturn",
              sourceId: sellerReturn.id,
              sourceLineId: returnItem.id,
              counterpartyType: "Seller",
              counterpartyId: seller.id,
            },
          ],
        });

        await createStockSnapshot(tx, {
          branchId: branch.id,
          productId: assignmentItem.productId,
          ownershipType: StockOwnershipType.SELLER_ASSIGNED,
          snapshotDate: returnDate,
          sourceKey: sellerReturn.returnNumber,
        });

        await createStockSnapshot(tx, {
          branchId: branch.id,
          productId: assignmentItem.productId,
          ownershipType: restoredOwnership,
          snapshotDate: returnDate,
          sourceKey: sellerReturn.returnNumber,
        });

        await syncLowStockAlert(tx, {
          branchId: branch.id,
          productId: assignmentItem.productId,
          threshold: assignmentItem.product.minimumStockAlert,
          evaluatedAt: returnDate,
        });
      }

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: "SELLER_RETURN",
        entityType: "SellerReturn",
        entityId: sellerReturn.id,
        branchId: branch.id,
        after: {
          returnNumber: sellerReturn.returnNumber,
          sellerId: seller.id,
          sellerName: seller.fullName,
          branchId: branch.id,
          branchName: branch.name,
          itemCount: parsed.data.items.length,
          totalQuantity: parsed.data.items.reduce(
            (sum, current) => sum + current.quantity,
            0,
          ),
        },
      });

      return sellerReturn.returnNumber;
    });

    revalidatePath("/sellers/list");
    revalidatePath("/sellers/intake-records");
    revalidatePath("/sellers/assigned-items");
    revalidatePath("/sellers/returns");
    revalidatePath("/sellers/settlements");
    revalidatePath("/reports/sellers");
    revalidatePath("/inventory/stock-overview");
    revalidatePath("/inventory/stock-movements");
    revalidatePath("/inventory/low-stock");
    revalidatePath("/inventory/out-of-stock");
    revalidatePath("/inventory/alert-records");
    revalidatePath("/sales/new");
    revalidatePath("/sales/daily-check");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Partner return ${returnReference} posted successfully.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(
        error,
        "Unable to record the partner return right now.",
      ),
    };
  }
}
