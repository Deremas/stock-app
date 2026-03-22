import { z } from "zod";

export const saleItemSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  ownedBatchId: z.string().optional(),
  quantity: z.coerce.number().int().positive("Quantity must be greater than zero"),
  unitPrice: z.coerce.number().positive("Price must be greater than zero"),
  discount: z.coerce.number().nonnegative("Discount must be zero or more"),
}).refine((value) => value.discount <= value.unitPrice, {
  message: "Discount cannot exceed unit price",
  path: ["discount"],
});

export const saleSchema = z.object({
  branchId: z.string().min(1, "Select a branch"),
  customerId: z.string().optional(),
  paymentMethod: z.enum(["CASH", "BANK", "MIXED", "CREDIT"]),
  soldAt: z.string().min(1, "Choose sale date"),
  note: z.string().max(500).optional(),
  items: z.array(saleItemSchema).min(1, "Add at least one item"),
});

export type SaleFormInput = z.input<typeof saleSchema>;
export type SaleInput = z.output<typeof saleSchema>;
