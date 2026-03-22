import { z } from "zod";

const optionalTrimmedString = (max: number, message: string) =>
  z.string().trim().max(max, message).optional().or(z.literal(""));

export const partnerCreateSchema = z.object({
  fullName: z.string().trim().min(2, "Enter partner name.").max(120, "Partner name is too long."),
  phone: z.string().trim().min(7, "Enter partner phone.").max(40, "Phone number is too long."),
  location: optionalTrimmedString(160, "Location is too long."),
  note: optionalTrimmedString(500, "Note is too long."),
});

export type PartnerCreateFormInput = z.input<typeof partnerCreateSchema>;
export type PartnerCreateInput = z.output<typeof partnerCreateSchema>;
