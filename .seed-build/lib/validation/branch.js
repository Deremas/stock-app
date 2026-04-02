import { z } from "zod";
export const branchSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Branch name must be at least 2 characters.")
        .max(60, "Branch name must be 60 characters or fewer."),
    location: z
        .string()
        .trim()
        .max(120, "Location must be 120 characters or fewer.")
        .optional()
        .or(z.literal("")),
});
export const branchUpdateSchema = branchSchema.extend({
    id: z.string().trim().min(1, "Branch id is required."),
});
