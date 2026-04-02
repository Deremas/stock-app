import { z } from "zod";
const optionalTrimmedString = (max, message) => z.string().trim().max(max, message).optional().or(z.literal(""));
const optionalPhoneString = z
    .string()
    .trim()
    .max(40, "Phone number is too long.")
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || value.length >= 7, {
    message: "Enter partner phone.",
});
export const partnerCreateSchema = z.object({
    fullName: z.string().trim().min(2, "Enter partner name.").max(120, "Partner name is too long."),
    phone: optionalPhoneString,
    location: optionalTrimmedString(160, "Location is too long."),
    note: optionalTrimmedString(500, "Note is too long."),
});
