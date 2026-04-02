import { z } from "zod";
export const loginSchema = z.object({
    identifier: z
        .string()
        .trim()
        .min(3, "Enter your email, username, or phone number"),
    password: z.string().min(4, "Password must be at least 4 characters"),
});
