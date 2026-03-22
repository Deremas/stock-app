import { z } from "zod";

export const transferItemSchema = z.object({
  productId: z.string().min(1, "Select an item."),
  ownedBatchId: z.string().min(1, "Select a batch."),
  quantity: z.coerce.number().int().positive("Quantity must be greater than zero."),
});

export const transferSchema = z
  .object({
    sourceBranchId: z.string().min(1, "Select a source branch."),
    destinationBranchId: z.string().min(1, "Select a destination branch."),
    transferAt: z.string().min(1, "Choose transfer date."),
    note: z.string().max(500).optional(),
    items: z.array(transferItemSchema).min(1, "Add at least one transfer line."),
  })
  .refine(
    (value) => value.sourceBranchId !== value.destinationBranchId,
    {
      message: "Source and destination branches must be different.",
      path: ["destinationBranchId"],
    },
  );

export type TransferFormInput = z.input<typeof transferSchema>;
export type TransferInput = z.output<typeof transferSchema>;
