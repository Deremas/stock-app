import { z } from "zod";

export const profileNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(60, "Name must be 60 characters or fewer."),
});

export const profilePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(4, "Current password must be at least 4 characters."),
    newPassword: z
      .string()
      .min(4, "New password must be at least 4 characters.")
      .max(128, "New password must be 128 characters or fewer."),
    confirmPassword: z
      .string()
      .min(4, "Confirm password must be at least 4 characters."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "New password and confirm password must match.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "New password must be different from current password.",
    path: ["newPassword"],
  });

export type ProfileNameFormInput = z.input<typeof profileNameSchema>;
export type ProfileNameInput = z.output<typeof profileNameSchema>;

export type ProfilePasswordFormInput = z.input<typeof profilePasswordSchema>;
export type ProfilePasswordInput = z.output<typeof profilePasswordSchema>;
