import { z } from "zod";

import { PRODUCT_UNIT_VALUES } from "@/lib/product-units";

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Item name must be at least 2 characters.")
    .max(120, "Item name must be 120 characters or fewer."),
  minimumStockAlert: z.coerce
    .number()
    .int("Low stock alert must be a whole number.")
    .min(0, "Low stock alert must be zero or more."),
  unit: z.enum(PRODUCT_UNIT_VALUES, {
    message: "Select a supported unit.",
  }),
  description: z
    .string()
    .trim()
    .max(300, "Description must be 300 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export const productEditorSchema = productSchema.extend({
  id: z.string().optional(),
});

export const productUpdateSchema = productSchema.extend({
  id: z.string().min(1, "Item id is required."),
});

export const productDeleteSchema = z.object({
  id: z.string().min(1, "Item id is required."),
});

export type ProductFormInput = z.input<typeof productSchema>;
export type ProductInput = z.output<typeof productSchema>;
export type ProductEditorFormInput = z.input<typeof productEditorSchema>;
export type ProductEditorInput = z.output<typeof productEditorSchema>;
export type ProductUpdateInput = z.output<typeof productUpdateSchema>;
export type ProductDeleteInput = z.output<typeof productDeleteSchema>;
