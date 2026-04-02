import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { sanitizeReturnToPath } from "@/lib/auth/return-to";
import { getUserAssignedBranchOptions, resolveActiveBranchId, sortBranchesByActive, } from "@/lib/branch-access";
import { getUserLoginLabel } from "@/lib/user-login";
export const getCurrentUser = cache(async () => {
    try {
        const requestHeaders = await headers();
        const session = await auth.api.getSession({
            headers: requestHeaders,
        });
        if (!session?.user) {
            return null;
        }
        const user = session.user;
        const currentSession = session.session;
        const assignedBranches = await getUserAssignedBranchOptions(user.id);
        const role = (user.role ?? "SALES");
        const activeBranchId = resolveActiveBranchId({
            branches: assignedBranches,
            defaultBranchId: user.defaultBranchId,
            sessionActiveBranchId: currentSession?.activeBranchId,
        });
        return {
            id: user.id,
            name: user.displayName ?? user.name,
            username: getUserLoginLabel(user),
            role,
            activeBranchId,
            branches: sortBranchesByActive(assignedBranches, activeBranchId),
        };
    }
    catch {
        return null;
    }
});
export async function requireSession() {
    const user = await getCurrentUser();
    if (!user) {
        const requestHeaders = await headers();
        const next = sanitizeReturnToPath(requestHeaders.get("x-return-to"));
        const params = new URLSearchParams({ next });
        redirect(`/login?${params.toString()}`);
    }
    return user;
}
export async function requireRole(roles) {
    const user = await requireSession();
    if (!roles.includes(user.role)) {
        redirect("/dashboard");
    }
    return user;
}
