"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/common";
import {
  getActionActor,
  getActionErrorMessage,
  normalizeOptionalString,
} from "@/lib/actions/common";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/inventory-ledger";
import {
  branchSchema,
  branchUpdateSchema,
  type BranchFormInput,
  type BranchUpdateFormInput,
} from "@/lib/validation/branch";

const deleteBranchSchema = z.object({
  branchId: z.string().trim().min(1, "Branch id is required."),
});

const setActiveBranchSchema = z.object({
  branchId: z.string().trim().min(1, "Select a branch."),
});

function buildBranchCodeSeed(name: string) {
  const seed = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return seed || "BRANCH";
}

async function generateUniqueBranchCode(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  name: string,
  ignoreBranchId?: string,
) {
  const base = buildBranchCodeSeed(name);
  let candidate = base;
  let suffix = 1;

  while (
    await tx.branch.findFirst({
      where: {
        code: candidate,
        ...(ignoreBranchId ? { id: { not: ignoreBranchId } } : {}),
      },
      select: { id: true },
    })
  ) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

export async function createBranchAction(
  input: BranchFormInput,
): Promise<ActionResult> {
  const actor = await getActionActor(["ADMIN"]);

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to create branches.",
    };
  }

  const parsed = branchSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Branch details are invalid.",
    };
  }

  const name = parsed.data.name.trim();
  const location = normalizeOptionalString(parsed.data.location);

  try {
    const branchName = await prisma.$transaction(async (tx) => {
      const existingByName = await tx.branch.findUnique({
        where: { name },
        select: { id: true },
      });

      if (existingByName) {
        throw new Error("A branch with that name already exists.");
      }

      const code = await generateUniqueBranchCode(tx, name);

      const branch = await tx.branch.create({
        data: {
          code,
          name,
          ...(location ? { location } : {}),
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
      });

      await tx.userBranch.upsert({
        where: {
          userId_branchId: {
            userId: actor.id,
            branchId: branch.id,
          },
        },
        update: {
          isActive: true,
        },
        create: {
          userId: actor.id,
          branchId: branch.id,
          isActive: true,
          isDefault: !actor.activeBranchId,
        },
      });

      const currentUser = await tx.user.findUnique({
        where: { id: actor.id },
        select: { defaultBranchId: true },
      });

      if (!currentUser?.defaultBranchId) {
        await tx.user.update({
          where: { id: actor.id },
          data: {
            defaultBranchId: branch.id,
          },
        });
      }

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: "BRANCH_CREATE",
        entityType: "Branch",
        entityId: branch.id,
        after: {
          code,
          name,
          location: location ?? null,
        },
      });

      return branch.name;
    });

    revalidatePath("/admin/branches");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `${branchName} created successfully.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(error, "Unable to create the branch right now."),
    };
  }
}

export async function deleteBranchAction(input: {
  branchId: string;
}): Promise<ActionResult> {
  const actor = await getActionActor(["ADMIN"]);

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to delete branches.",
    };
  }

  const parsed = deleteBranchSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Branch deletion request is invalid.",
    };
  }

  try {
    const deletedBranchName = await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findUnique({
        where: { id: parsed.data.branchId },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              purchases: true,
              sales: true,
              sellerIntakes: true,
              sellerAssignments: true,
              sellerReturns: true,
              sellerSettlements: true,
              sellerCollections: true,
              financeAccounts: true,
              expenses: true,
              customerPayments: true,
              supplierPayments: true,
              stockMovements: true,
              stockSnapshots: true,
              alertRecords: true,
              transfersFrom: true,
              transfersTo: true,
              ledgerEntries: true,
            },
          },
        },
      });

      if (!branch) {
        throw new Error("Branch not found.");
      }

      const hasActivity = Object.values(branch._count).some((count) => count > 0);

      if (hasActivity) {
        throw new Error(
          "This branch already has stock or transaction history and cannot be deleted.",
        );
      }

      await tx.auditLog.updateMany({
        where: { branchId: branch.id },
        data: { branchId: null },
      });

      await tx.session.updateMany({
        where: { activeBranchId: branch.id },
        data: { activeBranchId: null },
      });

      await tx.user.updateMany({
        where: { defaultBranchId: branch.id },
        data: { defaultBranchId: null },
      });

      await tx.userBranch.deleteMany({
        where: { branchId: branch.id },
      });

      await tx.branch.delete({
        where: { id: branch.id },
      });

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: "BRANCH_DELETE",
        entityType: "Branch",
        entityId: branch.id,
        after: {
          name: branch.name,
        },
      });

      return branch.name;
    });

    revalidatePath("/admin/branches");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `${deletedBranchName} deleted successfully.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(error, "Unable to delete the branch right now."),
    };
  }
}

export async function updateBranchAction(
  input: BranchUpdateFormInput,
): Promise<ActionResult> {
  const actor = await getActionActor(["ADMIN"]);

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to update branches.",
    };
  }

  const parsed = branchUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Branch details are invalid.",
    };
  }

  const name = parsed.data.name.trim();
  const location = normalizeOptionalString(parsed.data.location);

  try {
    const branchName = await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findUnique({
        where: {
          id: parsed.data.id,
        },
        select: {
          id: true,
          code: true,
          name: true,
          location: true,
        },
      });

      if (!branch) {
        throw new Error("Selected branch was not found.");
      }

      const existingByName = await tx.branch.findFirst({
        where: {
          name,
          id: {
            not: branch.id,
          },
        },
        select: { id: true },
      });

      if (existingByName) {
        throw new Error("A branch with that name already exists.");
      }

      const code = await generateUniqueBranchCode(tx, name, branch.id);

      await tx.branch.update({
        where: {
          id: branch.id,
        },
        data: {
          code,
          name,
          ...(location ? { location } : { location: null }),
        },
      });

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: "BRANCH_UPDATE",
        entityType: "Branch",
        entityId: branch.id,
        branchId: branch.id,
        before: {
          code: branch.code,
          name: branch.name,
          location: branch.location ?? null,
        },
        after: {
          code,
          name,
          location: location ?? null,
        },
      });

      return name;
    });

    revalidatePath("/admin/branches");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `${branchName} updated successfully.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(error, "Unable to update the branch right now."),
    };
  }
}

export async function setActiveBranchAction(input: {
  branchId: string;
}): Promise<ActionResult> {
  const actor = await getActionActor(["ADMIN", "SALES"]);

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to switch branches.",
    };
  }

  const parsed = setActiveBranchSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Branch selection is invalid.",
    };
  }

  try {
    const [assignment, requestHeaders] = await Promise.all([
      prisma.userBranch.findFirst({
        where: {
          userId: actor.id,
          branchId: parsed.data.branchId,
          isActive: true,
          branch: {
            isActive: true,
          },
        },
        select: {
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      headers(),
    ]);

    if (!assignment?.branch) {
      return {
        success: false,
        message: "You do not have access to that branch.",
      };
    }

    const session = await auth.api.getSession({
      headers: requestHeaders,
    });

    const currentSession = session?.session as
      | { id?: string; token?: string }
      | undefined;

    if (!currentSession?.id && !currentSession?.token) {
      return {
        success: false,
        message: "Your session could not be updated. Sign in again and retry.",
      };
    }

    if (currentSession.id) {
      await prisma.session.update({
        where: {
          id: currentSession.id,
        },
        data: {
          activeBranchId: assignment.branch.id,
        },
      });
    } else if (currentSession.token) {
      await prisma.session.update({
        where: {
          token: currentSession.token,
        },
        data: {
          activeBranchId: assignment.branch.id,
        },
      });
    }

    return {
      success: true,
      message: `Switched to ${assignment.branch.name}.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(error, "Unable to switch the branch right now."),
    };
  }
}
