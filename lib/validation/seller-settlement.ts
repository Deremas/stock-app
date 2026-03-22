import { z } from "zod";

export const sellerSettlementItemSchema = z.object({
  lineId: z.string().min(1, "Select a sold line."),
  amount: z.coerce.number().positive("Payment amount must be greater than zero."),
});

export const sellerSettlementSchema = z.object({
  sellerId: z.string().min(1, "Select a partner."),
  branchId: z.string().min(1, "Select a branch."),
  financeAccountId: z.string().min(1, "Select a payment account."),
  settlementDate: z.string().min(1, "Choose settlement date."),
  note: z
    .string()
    .trim()
    .max(300, "Note must be 300 characters or fewer.")
    .optional()
    .or(z.literal("")),
  items: z
    .array(sellerSettlementItemSchema)
    .min(1, "Add at least one sold line to pay."),
});

export type SellerSettlementFormInput = z.input<typeof sellerSettlementSchema>;
export type SellerSettlementInput = z.output<typeof sellerSettlementSchema>;
