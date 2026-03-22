import { z } from "zod";

const optionalTrimmedString = (max: number, message: string) =>
  z.string().trim().max(max, message).optional().or(z.literal(""));

export const customerCreateSchema = z.object({
  name: z.string().trim().min(2, "Enter customer name.").max(120, "Customer name is too long."),
  phone: optionalTrimmedString(40, "Phone number is too long."),
  location: optionalTrimmedString(160, "Location is too long."),
  note: optionalTrimmedString(500, "Note is too long."),
});

export type CustomerCreateFormInput = z.input<typeof customerCreateSchema>;
export type CustomerCreateInput = z.output<typeof customerCreateSchema>;
