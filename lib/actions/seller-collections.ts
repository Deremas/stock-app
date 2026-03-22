"use server";

import { revalidatePath } from "next/cache";

import { LedgerDirection, LedgerEntryType, SettlementStatus } from "@/generated/prisma/enums";

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
import { hasPermission } from "@/lib/rbac";
import { createAuditLog } from "@/lib/services/inventory-ledger";
import {
  sellerCollectionSchema,
  type SellerCollectionFormInput,
} from "@/lib/validation/seller-collection";

export async function createSellerCollectionAction(
  input: SellerCollectionFormInput,
): Promise<ActionResult> {
  const actor = await getActionActorByPermission("seller-settlements:create");

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to record partner collections.",
    };
  }

  const parsed = sellerCollectionSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ?? "Partner collection details are invalid.",
    };
  }

  const collectionDate = parseInputDate(parsed.data.collectionDate);

  if (!collectionDate) {
    return {
      success: false,
      message: "Collection date is invalid.",
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
      message: "You are not allowed to use finance accounts for partner collections.",
    };
  }

  try {
    const collectionReference = await prisma.$transaction(async (tx) => {
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
        throw new Error("Selected receiving account was not found.");
      }

      if (financeAccount.branchId && financeAccount.branchId !== branch.id) {
        throw new Error(
          "Receiving account must belong to the same branch as the collection.",
        );
      }

      const allocations = await tx.saleItemAllocation.findMany({
        where: {
          id: {
            in: selectedLineIds,
          },
          sourceType: "SELLER_ASSIGNED",
          saleItem: {
            sale: {
              branchId: branch.id,
            },
          },
          sellerAssignmentItem: {
            sellerIntakeItemId: null,
            sellerAssignment: {
              sellerId: seller.id,
            },
          },
        },
        select: {
          id: true,
          quantity: true,
          sellerAmount: true,
          collectionAllocations: {
            select: {
              amount: true,
            },
          },
          saleItem: {
            select: {
              sale: {
                select: {
                  saleNumber: true,
                  soldAt: true,
                },
              },
            },
          },
          sellerAssignmentItem: {
            select: {
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (allocations.length !== selectedLineIds.length) {
        throw new Error("One selected sold line is no longer available for collection.");
      }

      const allocationMap = new Map(
        allocations.map((allocation) => {
          const amountDue = Number(
            (
              Number(allocation.sellerAmount ?? 0) * allocation.quantity -
              allocation.collectionAllocations.reduce(
                (sum, item) => sum + Number(item.amount),
                0,
              )
            ).toFixed(2),
          );

          return [
            allocation.id,
            {
              id: allocation.id,
              amountDue,
              saleNumber: allocation.saleItem.sale.saleNumber,
              soldAt: allocation.saleItem.sale.soldAt,
              productName: allocation.sellerAssignmentItem?.product.name ?? "Assigned item",
            },
          ];
        }),
      );

      const normalizedItems = parsed.data.items.map((item) => {
        const allocation = allocationMap.get(item.lineId);

        if (!allocation) {
          throw new Error("One selected sold line could not be validated.");
        }

        if (allocation.amountDue <= 0) {
          throw new Error(
            `${allocation.productName} on ${allocation.saleNumber} is already fully collected.`,
          );
        }

        const normalizedAmount = Number(Number(item.amount).toFixed(2));

        if (normalizedAmount > allocation.amountDue) {
          throw new Error(
            `${allocation.productName} on ${allocation.saleNumber} has only ETB ${allocation.amountDue.toFixed(2)} left to collect.`,
          );
        }

        return {
          ...item,
          amount: normalizedAmount,
          saleNumber: allocation.saleNumber,
        };
      });

      const totalAmount = Number(
        normalizedItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2),
      );

      if (totalAmount <= 0) {
        throw new Error("Collection amount must be greater than zero.");
      }

      const collectionNumber = createDocumentNumber("COL", collectionDate);
      const collection = await tx.sellerCollection.create({
        data: {
          collectionNumber,
          sellerId: seller.id,
          branchId: branch.id,
          createdById: actor.id,
          financeAccountId: financeAccount.id,
          collectionDate,
          paymentMethod: financeAccount.type,
          status: SettlementStatus.POSTED,
          amount: toDecimal(totalAmount),
          ...(note ? { note } : {}),
        },
        select: {
          id: true,
          collectionNumber: true,
        },
      });

      for (const item of normalizedItems) {
        await tx.sellerCollectionAllocation.create({
          data: {
            sellerCollectionId: collection.id,
            saleItemAllocationId: item.lineId,
            amount: toDecimal(item.amount),
          },
        });
      }

      await tx.ledgerEntry.create({
        data: {
          entryDate: collectionDate,
          branchId: branch.id,
          financeAccountId: financeAccount.id,
          direction: LedgerDirection.DEBIT,
          amount: toDecimal(totalAmount),
          entryType: LedgerEntryType.SELLER_COLLECTION,
          referenceType: "SellerCollection",
          referenceId: collection.id,
          description: `Partner collection ${collection.collectionNumber} from ${seller.fullName}`,
        },
      });

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: "SELLER_COLLECTION",
        entityType: "SellerCollection",
        entityId: collection.id,
        branchId: branch.id,
        after: {
          collectionNumber: collection.collectionNumber,
          sellerId: seller.id,
          sellerName: seller.fullName,
          branchId: branch.id,
          branchName: branch.name,
          amount: totalAmount,
          financeAccountId: financeAccount.id,
          financeAccountName: financeAccount.name,
          lineCount: normalizedItems.length,
          salesCovered: [...new Set(normalizedItems.map((item) => item.saleNumber))],
        },
      });

      return collection.collectionNumber;
    });

    revalidatePath("/sellers/list");
    revalidatePath("/sellers/assigned-items");
    revalidatePath("/sellers/collections");
    revalidatePath("/sales/sold-items");
    revalidatePath("/sales/daily-check");
    revalidatePath("/finance/accounts");
    revalidatePath("/finance/cash");
    revalidatePath("/finance/ledger");
    revalidatePath("/reports/sellers");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Partner collection ${collectionReference} posted successfully.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(
        error,
        "Unable to record the partner collection right now.",
      ),
    };
  }
}
