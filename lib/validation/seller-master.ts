import { z } from "zod";

const optionalTrimmedString = (max: number, message: string) =>
  z.string().trim().max(max, message).optional().or(z.literal(""));

const optionalPhoneString = z
  .string()
  .trim()
  .max(40, "Phone number is too long.")
  .optional()
  .or(z.literal(""))
  .refine((value) => !value || value.length >= 7, {
    message: "Enter seller phone.",
  });

export const sellerCreateSchema = z.object({
  fullName: z.string().trim().min(2, "Enter seller name.").max(120, "Seller name is too long."),
  phone: optionalPhoneString,
  location: optionalTrimmedString(160, "Location is too long."),
  note: optionalTrimmedString(500, "Note is too long."),
});

export type SellerCreateFormInput = z.input<typeof sellerCreateSchema>;
export type SellerCreateInput = z.output<typeof sellerCreateSchema>;
