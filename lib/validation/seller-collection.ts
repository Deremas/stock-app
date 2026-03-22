import { z } from "zod";

export const sellerCollectionItemSchema = z.object({
  lineId: z.string().min(1, "Select a sold line"),
  amount: z.coerce
    .number()
    .positive("Collection amount must be greater than zero"),
});

export const sellerCollectionSchema = z.object({
  sellerId: z.string().min(1, "Select a partner"),
  branchId: z.string().min(1, "Select a branch"),
  financeAccountId: z.string().min(1, "Select a receiving account"),
  collectionDate: z.string().min(1, "Choose collection date"),
  note: z.string().max(500).optional(),
  items: z
    .array(sellerCollectionItemSchema)
    .min(1, "Add at least one sold line to collect"),
});

export type SellerCollectionFormInput = z.input<typeof sellerCollectionSchema>;
export type SellerCollectionInput = z.output<typeof sellerCollectionSchema>;
