import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
export { createDocumentNumber, getActionErrorMessage, normalizeOptionalString, parseInputDate, toDecimal, } from "./helpers";
export async function getActionActor(allowedRoles) {
    const user = await getCurrentUser();
    if (!user || !allowedRoles.includes(user.role)) {
        return null;
    }
    return user;
}
export async function getActionActorByPermission(requiredPermission) {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role, requiredPermission)) {
        return null;
    }
    return user;
}
