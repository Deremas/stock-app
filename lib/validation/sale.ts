import { z } from "zod";

export const saleItemSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  ownedBatchId: z.string().optional(),
  quantity: z.coerce.number().int().positive("Quantity must be greater than zero"),
  unitPrice: z.coerce.number().positive("Price must be greater than zero"),
  discount: z.coerce.number().nonnegative("Discount must be zero or more"),
  fixedDiscount: z.coerce.number().nonnegative("Fixed discount must be zero or more").optional().default(0),
}).refine((value) => value.discount <= value.unitPrice, {
  message: "Discount cannot exceed unit price",
  path: ["discount"],
}).refine((value) => value.fixedDiscount <= value.quantity * (value.unitPrice - value.discount), {
  message: "Fixed discount cannot exceed the line subtotal",
  path: ["fixedDiscount"],
});

export const saleSchema = z.object({
  branchId: z.string().min(1, "Select a branch"),
  customerId: z.string().optional(),
  paymentMethod: z.enum(["CASH", "BANK", "MIXED", "CREDIT"]),
  financeAccountId: z.string().optional().or(z.literal("")),
  mixedCashAmount: z.coerce.number().nonnegative().optional().default(0),
  mixedCashAccountId: z.string().optional().or(z.literal("")),
  mixedBankAmount: z.coerce.number().nonnegative().optional().default(0),
  mixedBankAccountId: z.string().optional().or(z.literal("")),
  mixedCreditAmount: z.coerce.number().nonnegative().optional().default(0),
  soldAt: z.string().min(1, "Choose sale date"),
  applyVat: z.boolean().optional().default(false),
  note: z.string().max(500).optional(),
  items: z.array(saleItemSchema).min(1, "Add at least one item"),
}).superRefine((value, ctx) => {
  if (value.paymentMethod === "CASH" && !value.financeAccountId?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select the cash account that received the sale.",
      path: ["financeAccountId"],
    });
  }

  if (value.paymentMethod === "BANK" && !value.financeAccountId?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select the bank account that received the sale.",
      path: ["financeAccountId"],
    });
  }

  if (value.paymentMethod === "CREDIT" && !value.customerId?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select a customer for credit sales.",
      path: ["customerId"],
    });
  }

  if (value.paymentMethod === "MIXED") {
    const activeMethods = [
      value.mixedCashAmount > 0,
      value.mixedBankAmount > 0,
      value.mixedCreditAmount > 0,
    ].filter(Boolean).length;

    if (activeMethods < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Split payment must use at least two payment methods.",
        path: ["paymentMethod"],
      });
    }
    if (value.mixedCashAmount > 0 && !value.mixedCashAccountId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select the cash account for the cash portion.",
        path: ["mixedCashAccountId"],
      });
    }
    if (value.mixedBankAmount > 0 && !value.mixedBankAccountId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select the bank account for the bank portion.",
        path: ["mixedBankAccountId"],
      });
    }
    if (value.mixedCreditAmount > 0 && !value.customerId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a customer for the credit portion.",
        path: ["customerId"],
      });
    }
  }
});

export type SaleFormInput = z.input<typeof saleSchema>;
export type SaleInput = z.output<typeof saleSchema>;
