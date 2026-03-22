import { z } from "zod";

export const expenseSchema = z.object({
  branchId: z.string().min(1, "Select a branch."),
  financeAccountId: z.string().min(1, "Select the payment account."),
  categoryName: z
    .string()
    .trim()
    .min(2, "Enter an expense category.")
    .max(80, "Expense category is too long."),
  name: z
    .string()
    .trim()
    .min(2, "Enter the expense name.")
    .max(120, "Expense name is too long."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  expenseDate: z.string().min(1, "Choose expense date."),
  note: z
    .string()
    .trim()
    .max(300, "Note must be 300 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export type ExpenseFormInput = z.input<typeof expenseSchema>;
export type ExpenseInput = z.output<typeof expenseSchema>;
