import { getCurrentUser } from "@/lib/auth/session";
import type { CurrentUser } from "@/lib/types";
import { hasPermission, type AppPermission, type AppRole } from "@/lib/rbac";

export {
  createDocumentNumber,
  getActionErrorMessage,
  normalizeOptionalString,
  parseInputDate,
  toDecimal,
} from "./helpers";

export type ActionResult = {
  success: boolean;
  message: string;
};

export async function getActionActor(
  allowedRoles: AppRole[],
): Promise<CurrentUser | null> {
  const user = await getCurrentUser();

  if (!user || !allowedRoles.includes(user.role)) {
    return null;
  }

  return user;
}

export async function getActionActorByPermission(
  requiredPermission: AppPermission,
): Promise<CurrentUser | null> {
  const user = await getCurrentUser();

  if (!user || !hasPermission(user.role, requiredPermission)) {
    return null;
  }

  return user;
}
