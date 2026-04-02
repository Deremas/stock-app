import { z } from "zod";
export const customerPaymentSchema = z
    .object({
    customerId: z.string().min(1, "Select a customer."),
    saleId: z.string().min(1, "Select a credit sale."),
    financeAccountId: z.string().min(1, "Select a payment account."),
    settlementMode: z.enum(["FULL", "PARTIAL"]),
    amount: z.coerce.number().positive("Amount must be greater than zero."),
    paymentDate: z.string().min(1, "Choose payment date."),
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
            message: "Enter a partial payment amount.",
            path: ["amount"],
        });
    }
});
