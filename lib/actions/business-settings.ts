"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/actions/common";
import {
  getActionActorByPermission,
  getActionErrorMessage,
  normalizeOptionalString,
  toDecimal,
} from "@/lib/actions/common";
import { prisma } from "@/lib/prisma";
import {
  businessSettingsSchema,
  type BusinessSettingsInput,
} from "@/lib/validation/business-settings";

export async function updateBusinessSettingsAction(
  input: BusinessSettingsInput,
): Promise<ActionResult> {
  const actor = await getActionActorByPermission("admin:manage");

  if (!actor) {
    return { success: false, message: "You are not allowed to change settings." };
  }

  const parsed = businessSettingsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Settings did not validate.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.businessSettings.findUnique({
        where: { id: "default" },
      });
      const data = {
        vatEnabled: parsed.data.vatEnabled,
        salesVatEnabled: parsed.data.vatEnabled && parsed.data.salesVatEnabled,
        purchaseVatEnabled:
          parsed.data.vatEnabled && parsed.data.purchaseVatEnabled,
        defaultSalesVatRate: toDecimal(parsed.data.defaultSalesVatRate),
        defaultPurchaseVatRate: toDecimal(parsed.data.defaultPurchaseVatRate),
        salesPriceMode: parsed.data.salesPriceMode,
        purchasePriceMode: parsed.data.purchasePriceMode,
        purchaseVatTreatment: parsed.data.purchaseVatTreatment,
        businessTaxId: normalizeOptionalString(parsed.data.businessTaxId) ?? null,
        updatedById: actor.id,
      } as const;

      const after = await tx.businessSettings.upsert({
        where: { id: "default" },
        create: { id: "default", ...data },
        update: data,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "BUSINESS_SETTINGS_UPDATE",
          entityType: "BusinessSettings",
          entityId: after.id,
          ...(before
            ? { before: {
                vatEnabled: before.vatEnabled,
                salesVatEnabled: before.salesVatEnabled,
                purchaseVatEnabled: before.purchaseVatEnabled,
                defaultSalesVatRate: Number(before.defaultSalesVatRate),
                defaultPurchaseVatRate: Number(before.defaultPurchaseVatRate),
                salesPriceMode: before.salesPriceMode,
                purchasePriceMode: before.purchasePriceMode,
                purchaseVatTreatment: before.purchaseVatTreatment,
                businessTaxId: before.businessTaxId,
              } }
            : {}),
          after: {
            vatEnabled: after.vatEnabled,
            salesVatEnabled: after.salesVatEnabled,
            purchaseVatEnabled: after.purchaseVatEnabled,
            defaultSalesVatRate: Number(after.defaultSalesVatRate),
            defaultPurchaseVatRate: Number(after.defaultPurchaseVatRate),
            salesPriceMode: after.salesPriceMode,
            purchasePriceMode: after.purchasePriceMode,
            purchaseVatTreatment: after.purchaseVatTreatment,
            businessTaxId: after.businessTaxId,
          },
        },
      });
    });

    revalidatePath("/admin/settings");
    revalidatePath("/sales/new");
    revalidatePath("/purchases/new");

    return { success: true, message: "Business and VAT settings saved." };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(error, "Unable to save settings right now."),
    };
  }
}
