import { z } from "zod";

export const sellerAssignmentItemSchema = z.object({
  ownedBatchId: z.string().min(1, "Select an available batch"),
  quantityAssigned: z.coerce
    .number()
    .int()
    .positive("Quantity must be greater than zero"),
  sellingPrice: z.coerce
    .number()
    .positive("Seller price must be greater than zero"),
});

export const sellerAssignmentSchema = z.object({
  branchId: z.string().min(1, "Select a branch"),
  sellerId: z.string().min(1, "Select a seller"),
  assignmentDate: z.string().min(1, "Choose assignment date"),
  note: z.string().max(500).optional(),
  items: z
    .array(sellerAssignmentItemSchema)
    .min(1, "Add at least one assignment line"),
});

export type SellerAssignmentFormInput = z.input<typeof sellerAssignmentSchema>;
export type SellerAssignmentInput = z.output<typeof sellerAssignmentSchema>;
