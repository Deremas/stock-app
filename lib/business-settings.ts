import { prisma } from "@/lib/prisma";
import type { TaxFormSettings } from "@/lib/types";

export const DEFAULT_BUSINESS_SETTINGS: TaxFormSettings = {
  vatEnabled: false,
  salesVatEnabled: false,
  purchaseVatEnabled: false,
  defaultSalesVatRate: 0,
  defaultPurchaseVatRate: 0,
  salesPriceMode: "EXCLUSIVE",
  purchasePriceMode: "EXCLUSIVE",
  purchaseVatTreatment: "RECOVERABLE",
  businessTaxId: "",
};

export async function getBusinessSettings(): Promise<TaxFormSettings> {
  const settings = await prisma.businessSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    return DEFAULT_BUSINESS_SETTINGS;
  }

  return {
    vatEnabled: settings.vatEnabled,
    salesVatEnabled: settings.salesVatEnabled,
    purchaseVatEnabled: settings.purchaseVatEnabled,
    defaultSalesVatRate: Number(settings.defaultSalesVatRate),
    defaultPurchaseVatRate: Number(settings.defaultPurchaseVatRate),
    salesPriceMode: settings.salesPriceMode,
    purchasePriceMode: settings.purchasePriceMode,
    purchaseVatTreatment: settings.purchaseVatTreatment,
    businessTaxId: settings.businessTaxId ?? "",
  };
}
