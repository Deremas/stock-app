import { z } from "zod";

import { APP_ROLES } from "@/lib/rbac";

const branchIdsSchema = z
  .array(z.string().trim().min(1, "Select a branch."))
  .min(1, "Assign at least one branch.");

const userEditorBaseSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters.")
      .max(120, "Name must be 120 characters or fewer."),
    email: z.email("Enter a valid email address.").trim().toLowerCase(),
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters.")
      .max(40, "Username must be 40 characters or fewer.")
      .regex(
        /^[a-zA-Z0-9._-]+$/,
        "Username can only contain letters, numbers, dots, dashes, and underscores.",
      ),
    phone: z
      .string()
      .trim()
      .min(7, "Phone must be at least 7 characters.")
      .max(30, "Phone must be 30 characters or fewer."),
    role: z.enum(APP_ROLES),
    branchIds: branchIdsSchema,
    defaultBranchId: z.string().trim().min(1, "Select a default branch."),
  })
  .refine((value) => value.branchIds.includes(value.defaultBranchId), {
    message: "Default branch must be one of the assigned branches.",
    path: ["defaultBranchId"],
  });

export const userSchema = userEditorBaseSchema.extend({
  password: z
    .string()
    .min(4, "Password must be at least 4 characters.")
    .max(128, "Password must be 128 characters or fewer."),
});

export const userUpdateSchema = userEditorBaseSchema.extend({
  id: z.string().trim().min(1, "User id is required."),
  password: z
    .string()
    .max(128, "Password must be 128 characters or fewer.")
    .optional()
    .or(z.literal("")),
}).refine((value) => !value.password || value.password.length >= 4, {
  message: "Password must be at least 4 characters.",
  path: ["password"],
});

export type UserFormInput = z.input<typeof userSchema>;
export type UserInput = z.output<typeof userSchema>;
export type UserUpdateFormInput = z.input<typeof userUpdateSchema>;
export type UserUpdateInput = z.output<typeof userUpdateSchema>;
