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
    paymentMethod: z.enum(["CASH", "BANK", "CREDIT"]),
    financeAccountId: z.string().optional().or(z.literal("")),
    soldAt: z.string().min(1, "Choose sale date"),
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
});
