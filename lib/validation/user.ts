import { z } from "zod";

import { APP_ROLES } from "@/lib/rbac";
import { ARCHIVED_USER_USERNAME_PREFIX } from "@/lib/user-archive";

const emailValueSchema = z
  .string()
  .trim()
  .max(254, "Email must be 254 characters or fewer.")
  .refine((value) => !value || z.email().safeParse(value).success, {
    message: "Enter a valid email address.",
  })
  .transform((value) => value.toLowerCase());

const usernameValueSchema = z
  .string()
  .trim()
  .max(40, "Username must be 40 characters or fewer.")
  .refine((value) => !value || value.length >= 3, {
    message: "Username must be at least 3 characters.",
  })
  .refine((value) => !value || /^[a-zA-Z0-9._-]+$/.test(value), {
    message:
      "Username can only contain letters, numbers, dots, dashes, and underscores.",
  });

const phoneValueSchema = z
  .string()
  .trim()
  .max(30, "Phone must be 30 characters or fewer.")
  .refine((value) => !value || value.length >= 7, {
    message: "Phone must be at least 7 characters.",
  });

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
    email: emailValueSchema,
    username: usernameValueSchema,
    phone: phoneValueSchema,
    role: z.enum(APP_ROLES),
    branchIds: branchIdsSchema,
    defaultBranchId: z.string().trim().min(1, "Select a default branch."),
  })
  .superRefine((value, ctx) => {
    if (!value.email && !value.username && !value.phone) {
      const message = "Enter at least one login ID: email, username, or phone.";

      ctx.addIssue({
        code: "custom",
        message,
        path: ["email"],
      });
      ctx.addIssue({
        code: "custom",
        message,
        path: ["username"],
      });
      ctx.addIssue({
        code: "custom",
        message,
        path: ["phone"],
      });
    }

    if (
      value.username &&
      value.username.toLowerCase().startsWith(ARCHIVED_USER_USERNAME_PREFIX)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "This username uses a reserved system prefix.",
        path: ["username"],
      });
    }
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

export const userStatusSchema = z.object({
  userId: z.string().trim().min(1, "User id is required."),
  isActive: z.boolean(),
});

export const userDeleteSchema = z.object({
  userId: z.string().trim().min(1, "User id is required."),
});

export type UserFormInput = z.input<typeof userSchema>;
export type UserInput = z.output<typeof userSchema>;
export type UserUpdateFormInput = z.input<typeof userUpdateSchema>;
export type UserUpdateInput = z.output<typeof userUpdateSchema>;
export type UserStatusInput = z.output<typeof userStatusSchema>;
export type UserDeleteInput = z.output<typeof userDeleteSchema>;
