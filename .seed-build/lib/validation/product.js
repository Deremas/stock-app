import { z } from "zod";
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
    unit: z
        .string()
        .trim()
        .min(1, "Unit is required.")
        .max(20, "Unit must be 20 characters or fewer."),
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
