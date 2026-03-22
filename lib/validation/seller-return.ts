import { z } from "zod";

export const sellerReturnItemSchema = z.object({
  lineId: z.string().min(1, "Select a return line"),
  quantity: z.coerce
    .number()
    .int()
    .positive("Return quantity must be greater than zero"),
});

export const sellerReturnSchema = z.object({
  branchId: z.string().min(1, "Select a branch"),
  sellerId: z.string().min(1, "Select a partner"),
  returnDate: z.string().min(1, "Choose return date"),
  note: z.string().max(500).optional(),
  items: z.array(sellerReturnItemSchema).min(1, "Add at least one return line"),
});

export type SellerReturnFormInput = z.input<typeof sellerReturnSchema>;
export type SellerReturnInput = z.output<typeof sellerReturnSchema>;
