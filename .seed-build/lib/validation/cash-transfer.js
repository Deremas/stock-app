import { z } from "zod";
export const cashTransferSchema = z
    .object({
    branchId: z.string().min(1, "Select a branch."),
    fromAccountId: z.string().min(1, "Select the cash account."),
    toAccountId: z.string().min(1, "Select the bank account."),
    amount: z.coerce.number().positive("Amount must be greater than zero."),
    transferDate: z.string().min(1, "Choose transfer date."),
    note: z
        .string()
        .trim()
        .max(300, "Note must be 300 characters or fewer.")
        .optional()
        .or(z.literal("")),
})
    .superRefine((value, ctx) => {
    if (value.fromAccountId === value.toAccountId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Cash account and bank account must be different.",
            path: ["toAccountId"],
        });
    }
});
