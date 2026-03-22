import { z } from "zod";

export const purchaseItemSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  quantity: z.coerce.number().int().positive("Quantity must be greater than zero"),
  unitCost: z.coerce.number().positive("Unit cost must be greater than zero"),
  sellingPrice: z.coerce.number().nonnegative("Selling price must be zero or more"),
});

export const purchaseSchema = z.object({
  branchId: z.string().min(1, "Select a branch"),
  supplierId: z.string().min(1, "Select a supplier"),
  paymentAccountId: z.string().optional(),
  settlementMode: z.enum(["UNPAID", "FULL", "PARTIAL"]),
  amountPaid: z.coerce.number().nonnegative("Paid amount must be zero or more"),
  purchasedAt: z.string().min(1, "Choose purchase date"),
  note: z.string().max(500).optional(),
  items: z.array(purchaseItemSchema).min(1, "Add at least one line item"),
}).superRefine((value, ctx) => {
  const subtotal = value.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const seenProductIds = new Set<string>();

  value.items.forEach((item, index) => {
    if (!item.productId) {
      return;
    }

    if (seenProductIds.has(item.productId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "This item is already added. Increase its quantity on the existing line instead.",
        path: ["items", index, "productId"],
      });
      return;
    }

    seenProductIds.add(item.productId);
  });

  if (value.settlementMode !== "UNPAID" && !value.paymentAccountId?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select a payment account.",
      path: ["paymentAccountId"],
    });
  }

  if (value.settlementMode === "UNPAID" && value.amountPaid > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Paid amount must stay zero when payment is set to pay later.",
      path: ["amountPaid"],
    });
  }

  if (value.settlementMode === "PARTIAL") {
    if (value.amountPaid <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter the amount paid now.",
        path: ["amountPaid"],
      });
    }

    if (subtotal > 0 && value.amountPaid >= subtotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Partial payment must be less than the purchase total.",
        path: ["amountPaid"],
      });
    }
  }
});

export type PurchaseFormInput = z.input<typeof purchaseSchema>;
export type PurchaseInput = z.output<typeof purchaseSchema>;
