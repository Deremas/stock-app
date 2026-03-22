import { z } from "zod";

export const sellerSettlementSchema = z
  .object({
    sellerId: z.string().min(1, "Select a partner."),
    branchId: z.string().min(1, "Select a branch."),
    financeAccountId: z.string().min(1, "Select a payment account."),
    settlementMode: z.enum(["FULL", "PARTIAL"]),
    amount: z.coerce.number().positive("Amount must be greater than zero."),
    settlementDate: z.string().min(1, "Choose settlement date."),
    note: z
      .string()
      .trim()
      .max(300, "Note must be 300 characters or fewer.")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (value.settlementMode === "PARTIAL" && value.amount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a partial settlement amount.",
        path: ["amount"],
      });
    }
  });

export type SellerSettlementFormInput = z.input<typeof sellerSettlementSchema>;
export type SellerSettlementInput = z.output<typeof sellerSettlementSchema>;
