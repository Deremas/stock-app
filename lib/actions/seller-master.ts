"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getActionActorByPermission, getActionErrorMessage } from "@/lib/actions/common";
import { createAuditLog } from "@/lib/services/inventory-ledger";
import {
  sellerCreateSchema,
  type SellerCreateFormInput,
} from "@/lib/validation/seller-master";

type CreateSellerActionResult = {
  success: boolean;
  message: string;
  seller?: { id: string; name: string };
};

export async function createSellerAction(
  input: SellerCreateFormInput,
): Promise<CreateSellerActionResult> {
  const actor = await getActionActorByPermission("sellers:manage");

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to create sellers.",
    };
  }

  const parsed = sellerCreateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Seller details are invalid.",
    };
  }

  try {
    const seller = await prisma.$transaction(async (tx) => {
      const newSeller = await tx.seller.create({
        data: {
          fullName: parsed.data.fullName,
          phone: parsed.data.phone || null,
          address: parsed.data.location || null,
          note: parsed.data.note || null,
        },
        select: {
          id: true,
          fullName: true,
        },
      });

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: "SELLER_CREATE",
        entityType: "Seller",
        entityId: newSeller.id,
        after: newSeller,
      });

      return newSeller;
    });

    revalidatePath("/sellers/list");
    revalidatePath("/sellers/new-intake");
    revalidatePath("/sellers/assign-items");

    return {
      success: true,
      message: `Seller "${seller.fullName}" created successfully.`,
      seller: { id: seller.id, name: seller.fullName },
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(error, "Unable to create the seller record."),
    };
  }
}
