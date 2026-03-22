"use server";

import { revalidatePath } from "next/cache";

import { LedgerDirection, LedgerEntryType, SettlementStatus } from "@/generated/prisma/enums";

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
import { createAuditLog } from "@/lib/services/inventory-ledger";
import {
  sellerSettlementSchema,
  type SellerSettlementFormInput,
} from "@/lib/validation/seller-settlement";

export async function createSellerSettlementAction(
  input: SellerSettlementFormInput,
): Promise<ActionResult> {
  const actor = await getActionActor(["ADMIN", "SALES"]);

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to record partner settlements.",
    };
  }

  const parsed = sellerSettlementSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ?? "Partner settlement details are invalid.",
    };
  }

  const settlementDate = parseInputDate(parsed.data.settlementDate);

  if (!settlementDate) {
    return {
      success: false,
      message: "Settlement date is invalid.",
    };
  }

  const note = normalizeOptionalString(parsed.data.note);

  try {
    const settlementReference = await prisma.$transaction(async (tx) => {
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

      const branch = await tx.branch.findUnique({
        where: {
          id: parsed.data.branchId,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!branch) {
        throw new Error("Selected branch was not found.");
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
        throw new Error("Selected payment account was not found.");
      }

      if (financeAccount.branchId && financeAccount.branchId !== branch.id) {
        throw new Error(
          "Payment account must belong to the same branch as the settlement.",
        );
      }

      const allocations = await tx.saleItemAllocation.findMany({
        where: {
          sourceType: {
            in: ["SELLER_CONSIGNMENT", "SELLER_ASSIGNED"],
          },
          saleItem: {
            sale: {
              branchId: branch.id,
            },
          },
          OR: [
            {
              sellerIntakeItem: {
                sellerIntake: {
                  sellerId: seller.id,
                },
              },
            },
            {
              sellerAssignmentItem: {
                sellerAssignment: {
                  sellerId: seller.id,
                },
              },
            },
          ],
        },
        select: {
          id: true,
          quantity: true,
          sellerAmount: true,
          settlementAllocations: {
            select: {
              amount: true,
            },
          },
          saleItem: {
            select: {
              createdAt: true,
              sale: {
                select: {
                  soldAt: true,
                },
              },
            },
          },
        },
      });

      const openAllocations = allocations
        .map((allocation) => {
          const gross = Number(allocation.sellerAmount ?? 0) * allocation.quantity;
          const settled = allocation.settlementAllocations.reduce(
            (sum, item) => sum + Number(item.amount),
            0,
          );
          const amountDue = Number((gross - settled).toFixed(2));

          return {
            id: allocation.id,
            amountDue,
            soldAt: allocation.saleItem.sale.soldAt,
            createdAt: allocation.saleItem.createdAt,
          };
        })
        .filter((allocation) => allocation.amountDue > 0)
        .sort((left, right) => {
          const soldAtDiff = left.soldAt.getTime() - right.soldAt.getTime();

          if (soldAtDiff !== 0) {
            return soldAtDiff;
          }

          return left.createdAt.getTime() - right.createdAt.getTime();
        });

      const currentDue = Number(
        openAllocations.reduce((sum, allocation) => sum + allocation.amountDue, 0).toFixed(2),
      );

      if (currentDue <= 0) {
        throw new Error("This partner has no outstanding payable left to settle in the selected branch.");
      }

      const amount =
        parsed.data.settlementMode === "FULL" ? currentDue : parsed.data.amount;

      if (amount > currentDue) {
        throw new Error("Settlement amount cannot exceed the outstanding payable.");
      }

      const settlementNumber = createDocumentNumber("SET", settlementDate);
      const settlement = await tx.sellerSettlement.create({
        data: {
          settlementNumber,
          sellerId: seller.id,
          branchId: branch.id,
          createdById: actor.id,
          financeAccountId: financeAccount.id,
          settlementDate,
          paymentMethod: financeAccount.type,
          status: SettlementStatus.POSTED,
          amount: toDecimal(amount),
          ...(note ? { note } : {}),
        },
        select: {
          id: true,
          settlementNumber: true,
        },
      });

      let remainingAmount = amount;

      for (const allocation of openAllocations) {
        if (remainingAmount <= 0) {
          break;
        }

        const allocatedAmount = Math.min(remainingAmount, allocation.amountDue);

        await tx.sellerSettlementAllocation.create({
          data: {
            sellerSettlementId: settlement.id,
            saleItemAllocationId: allocation.id,
            amount: toDecimal(allocatedAmount),
          },
        });

        remainingAmount = Number((remainingAmount - allocatedAmount).toFixed(2));
      }

      await tx.ledgerEntry.create({
        data: {
          entryDate: settlementDate,
          branchId: branch.id,
          financeAccountId: financeAccount.id,
          direction: LedgerDirection.CREDIT,
          amount: toDecimal(amount),
          entryType: LedgerEntryType.SELLER_SETTLEMENT,
          referenceType: "SellerSettlement",
          referenceId: settlement.id,
          description: `Partner settlement ${settlement.settlementNumber} for ${seller.fullName}`,
        },
      });

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: "SELLER_SETTLEMENT",
        entityType: "SellerSettlement",
        entityId: settlement.id,
        branchId: branch.id,
        after: {
          settlementNumber: settlement.settlementNumber,
          sellerId: seller.id,
          sellerName: seller.fullName,
          branchId: branch.id,
          branchName: branch.name,
          amount,
          settlementMode: parsed.data.settlementMode,
          remainingDue: Number((currentDue - amount).toFixed(2)),
          financeAccountId: financeAccount.id,
          financeAccountName: financeAccount.name,
        },
      });

      return settlement.settlementNumber;
    });

    revalidatePath("/sellers/list");
    revalidatePath("/sellers/settlements");
    revalidatePath("/sales/sold-items");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Partner settlement ${settlementReference} posted successfully.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(
        error,
        "Unable to record the partner settlement right now.",
      ),
    };
  }
}
