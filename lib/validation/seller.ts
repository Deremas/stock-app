import { z } from "zod";

export const sellerIntakeItemSchema = z.object({
  productId: z.string().min(1, "Select product"),
  quantityBrought: z.coerce.number().int().positive("Quantity must be greater than zero"),
  sellerFixedPrice: z.coerce.number().positive("Seller fixed price is required"),
  targetSellingPrice: z.coerce.number().positive("Target selling price is required"),
});

export const sellerIntakeSchema = z.object({
  branchId: z.string().min(1, "Select a branch"),
  sellerId: z.string().min(1, "Select a seller"),
  bringingDate: z.string().min(1, "Choose bringing date"),
  note: z.string().max(500).optional(),
  items: z.array(sellerIntakeItemSchema).min(1, "Add at least one intake line"),
});

export type SellerIntakeFormInput = z.input<typeof sellerIntakeSchema>;
export type SellerIntakeInput = z.output<typeof sellerIntakeSchema>;
