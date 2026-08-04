import { z } from "zod";

export const businessSettingsSchema = z
  .object({
    vatEnabled: z.boolean(),
    salesVatEnabled: z.boolean(),
    purchaseVatEnabled: z.boolean(),
    defaultSalesVatRate: z.coerce.number().min(0).max(100),
    defaultPurchaseVatRate: z.coerce.number().min(0).max(100),
    salesPriceMode: z.enum(["EXCLUSIVE", "INCLUSIVE"]),
    purchasePriceMode: z.enum(["EXCLUSIVE", "INCLUSIVE"]),
    purchaseVatTreatment: z.enum(["RECOVERABLE", "NON_RECOVERABLE"]),
    businessTaxId: z.string().max(100).optional().default(""),
  })
  .superRefine((value, ctx) => {
    if (value.vatEnabled && value.salesVatEnabled && value.defaultSalesVatRate <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultSalesVatRate"],
        message: "Enter a sales VAT rate greater than zero.",
      });
    }

    if (
      value.vatEnabled &&
      value.purchaseVatEnabled &&
      value.defaultPurchaseVatRate <= 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultPurchaseVatRate"],
        message: "Enter a purchase VAT rate greater than zero.",
      });
    }
  });

export type BusinessSettingsInput = z.input<typeof businessSettingsSchema>;
