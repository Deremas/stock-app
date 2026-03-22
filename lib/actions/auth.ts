"use server";

import type { ActionResult } from "@/lib/actions/common";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

export async function loginAction(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Login data is invalid.",
    };
  }

  return {
    success: true,
    message:
      "Credentials validated. Wire this action to better-auth session creation after dependency installation.",
  };
}

