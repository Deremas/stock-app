import { prisma } from "@/lib/prisma";
export async function getUserAssignedBranchOptions(userId) {
    const assignments = await prisma.userBranch.findMany({
        where: {
            userId,
            isActive: true,
            branch: {
                isActive: true,
            },
        },
        orderBy: [{ isDefault: "desc" }, { branch: { name: "asc" } }],
        select: {
            branch: {
                select: {
                    id: true,
                    code: true,
                    name: true,
                },
            },
        },
    });
    return assignments.map((assignment) => assignment.branch);
}
export function resolveActiveBranchId(input) {
    const branchIds = new Set(input.branches.map((branch) => branch.id));
    if (input.sessionActiveBranchId &&
        branchIds.has(input.sessionActiveBranchId)) {
        return input.sessionActiveBranchId;
    }
    if (input.defaultBranchId && branchIds.has(input.defaultBranchId)) {
        return input.defaultBranchId;
    }
    return input.branches[0]?.id ?? "";
}
export function sortBranchesByActive(branches, activeBranchId) {
    if (!activeBranchId) {
        return branches;
    }
    return [...branches].sort((left, right) => {
        if (left.id === activeBranchId) {
            return -1;
        }
        if (right.id === activeBranchId) {
            return 1;
        }
        return left.name.localeCompare(right.name);
    });
}
