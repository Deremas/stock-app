"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

import {
  StockMovementType,
  StockOwnershipType,
} from "@/generated/prisma/enums";

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
  sellerIntakeSchema,
  type SellerIntakeFormInput,
} from "@/lib/validation/seller";


export async function createSellerIntakeAction(
  input: SellerIntakeFormInput,
): Promise<ActionResult> {
  const actor = await getActionActorByPermission("sellers:manage");

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to record received seller items.",
    };
  }

  const parsed = sellerIntakeSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ?? "Received items payload did not validate.",
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

      const productIds = [...new Set(parsed.data.items.map((item) => item.productId))];
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          minimumStockAlert: true,
        },
      });

      if (products.length !== productIds.length) {
        throw new Error("One or more selected products no longer exist.");
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      for (const item of parsed.data.items) {
        const product = productMap.get(item.productId);
        if (!product) throw new Error("Product not found");

        const intakeItem = await tx.sellerIntakeItem.create({
          data: {
            sellerIntakeId: intake.id,
            productId: product.id,
            quantityBrought: item.quantityBrought,
            sellerFixedPrice: toDecimal(item.sellerFixedPrice),
            targetSellingPrice: toDecimal(item.targetSellingPrice),
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
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(
        error,
        "Unable to post the received items right now.",
      ),
    };
  }
}

export async function createBulkSellerIntakeAction(input: {
  branchId: string;
  sellerId: string;
  bringingDate: string;
  note?: string;
  items: {
    productName: string;
    quantityBrought: number;
    sellerFixedPrice: number;
    targetSellingPrice: number;
  }[];
}): Promise<ActionResult> {
  const actor = await getActionActorByPermission("sellers:manage");

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to record bulk seller items.",
    };
  }

  const bringingDate = parseInputDate(input.bringingDate);
  if (!bringingDate) {
    return { success: false, message: "Bringing date is invalid." };
  }

  const note = normalizeOptionalString(input.note);

  try {
    const intakeReference = await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findUnique({
        where: { id: input.branchId },
        select: { id: true },
      });
      if (!branch) throw new Error("Branch not found.");

      const seller = await tx.seller.findUnique({
        where: { id: input.sellerId },
        select: { id: true },
      });
      if (!seller) throw new Error("Seller not found.");

      const productNames = [...new Set(input.items.map((i) => i.productName))];
      const products = await tx.product.findMany({
        where: { name: { in: productNames, mode: "insensitive" } },
        select: { id: true, name: true, minimumStockAlert: true },
      });

      const productMap = new Map(products.map((p) => [p.name.toLowerCase(), p]));
      const missingProducts = productNames.filter(
        (name) => !productMap.has(name.toLowerCase()),
      );

      if (missingProducts.length > 0) {
        throw new Error(
          `Products not found: ${missingProducts.slice(0, 3).join(", ")}${missingProducts.length > 3 ? "..." : ""}. Please create them first.`,
        );
      }

      const intakeNumber = createDocumentNumber("INT-B", bringingDate);
      const intake = await tx.sellerIntake.create({
        data: {
          intakeNumber,
          sellerId: seller.id,
          branchId: branch.id,
          createdById: actor.id,
          bringingDate,
          ...(note ? { note } : {}),
        },
      });

      for (const item of input.items) {
        const product = productMap.get(item.productName.toLowerCase());
        if (!product) continue;

        const intakeItem = await tx.sellerIntakeItem.create({
          data: {
            sellerIntakeId: intake.id,
            productId: product.id,
            quantityBrought: item.quantityBrought,
            sellerFixedPrice: toDecimal(item.sellerFixedPrice),
            targetSellingPrice: toDecimal(item.targetSellingPrice),
            bringingDate,
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
        action: "SELLER_INTAKE_CREATE_BULK",
        entityType: "SellerIntake",
        entityId: intake.id,
        branchId: branch.id,
        after: {
          intakeNumber: intake.intakeNumber,
          sellerId: seller.id,
          itemCount: input.items.length,
        },
      });

      return intake.intakeNumber;
    });

    revalidatePath("/sellers/list");
    revalidatePath("/sellers/intake-records");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Bulk intake ${intakeReference} with ${input.items.length} items posted successfully.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(error, "Bulk intake failed."),
    };
  }
}
