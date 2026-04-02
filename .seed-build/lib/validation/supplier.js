import { z } from "zod";
const optionalTrimmedString = (max, message) => z.string().trim().max(max, message).optional().or(z.literal(""));
export const supplierCreateSchema = z.object({
    name: z.string().trim().min(2, "Enter supplier name.").max(120, "Supplier name is too long."),
    phone: z
        .string()
        .trim()
        .max(40, "Phone number is too long.")
        .optional()
        .or(z.literal("")),
    location: optionalTrimmedString(160, "Location is too long."),
    note: optionalTrimmedString(500, "Note is too long."),
});
export const supplierQuickCreateSchema = supplierCreateSchema;
