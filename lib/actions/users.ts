"use server";

import argon2 from "argon2";
import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/actions/common";
import { getActionActor, getActionErrorMessage } from "@/lib/actions/common";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/inventory-ledger";
import {
  buildGeneratedUsername,
  getUserDisplayUsername,
  getUserLoginLabel,
} from "@/lib/user-login";
import { buildArchivedUsername, isArchivedUsername } from "@/lib/user-archive";
import {
  userDeleteSchema,
  userSchema,
  userStatusSchema,
  userUpdateSchema,
  type UserDeleteInput,
  type UserInput,
  type UserStatusInput,
  type UserUpdateInput,
} from "@/lib/validation/user";

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function normalizePhoneIdentifier(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveUserIdentity(input: {
  email: string;
  username: string;
  phone: string;
}) {
  const email = normalizeOptionalString(input.email)?.toLowerCase() ?? null;
  const displayUsername = normalizeOptionalString(input.username);
  const phone = normalizeOptionalString(input.phone);

  return {
    email,
    phone,
    normalizedPhone: phone ? normalizePhoneIdentifier(phone) : null,
    username: displayUsername ? displayUsername.toLowerCase() : buildGeneratedUsername(),
    displayUsername,
  };
}

async function validateAssignedBranches(
  tx: TransactionClient,
  branchIds: string[],
) {
  const branches = await tx.branch.findMany({
    where: {
      id: {
        in: branchIds,
      },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (branches.length !== branchIds.length) {
    throw new Error("Select only active branches for this user.");
  }

  return branches;
}

async function assertUniqueUserIdentity(args: {
  tx: TransactionClient;
  email: string | null;
  username: string;
  normalizedPhone: string | null;
  ignoreUserId?: string;
}) {
  const [existingEmail, existingUsername, existingPhoneUsers] = await Promise.all([
    args.email
      ? args.tx.user.findFirst({
          where: {
            ...(args.ignoreUserId ? { id: { not: args.ignoreUserId } } : {}),
            email: {
              equals: args.email,
              mode: "insensitive",
            },
          },
          select: {
            id: true,
          },
        })
      : null,
    args.tx.user.findFirst({
      where: {
        ...(args.ignoreUserId ? { id: { not: args.ignoreUserId } } : {}),
        username: {
          equals: args.username,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    }),
    args.normalizedPhone
      ? args.tx.user.findMany({
          where: {
            ...(args.ignoreUserId ? { id: { not: args.ignoreUserId } } : {}),
            phone: {
              not: null,
            },
          },
          select: {
            id: true,
            phone: true,
          },
        })
      : [],
  ]);

  if (existingEmail) {
    throw new Error("A user with that email already exists.");
  }

  if (existingUsername) {
    throw new Error("That username is already taken.");
  }

  const duplicatePhone = args.normalizedPhone
    ? existingPhoneUsers.find(
        (user) => normalizePhoneIdentifier(user.phone ?? "") === args.normalizedPhone,
      )
    : null;

  if (duplicatePhone) {
    throw new Error("That phone number is already linked to another user.");
  }
}

function buildBranchAssignments(branchIds: string[], defaultBranchId: string) {
  return branchIds.map((branchId) => ({
    branchId,
    isActive: true,
    isDefault: branchId === defaultBranchId,
  }));
}

async function getManagedUser(tx: TransactionClient, userId: string) {
  return tx.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      displayName: true,
      username: true,
      displayUsername: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      defaultBranchId: true,
    },
  });
}

function getManagedUserName(user: {
  name: string;
  displayName?: string | null;
}) {
  return user.displayName?.trim() || user.name;
}

async function ensureUserCanBeDisabledOrDeleted(args: {
  tx: TransactionClient;
  actorId: string;
  user: {
    id: string;
    role: "ADMIN" | "SALES";
    isActive: boolean;
  };
  action: "deactivate" | "delete";
}) {
  if (args.user.id === args.actorId) {
    throw new Error(
      args.action === "delete"
        ? "You cannot delete your own account."
        : "You cannot deactivate your own account.",
    );
  }

  if (args.user.role !== "ADMIN" || !args.user.isActive) {
    return;
  }

  const otherActiveAdmins = await args.tx.user.count({
    where: {
      role: "ADMIN",
      isActive: true,
      id: {
        not: args.user.id,
      },
    },
  });

  if (otherActiveAdmins === 0) {
    throw new Error("Keep at least one active admin user.");
  }
}

export async function createUserAction(input: UserInput): Promise<ActionResult> {
  const actor = await getActionActor(["ADMIN"]);

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to create users.",
    };
  }

  const parsed = userSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "User details are invalid.",
    };
  }

  const name = parsed.data.name.trim();
  const identity = resolveUserIdentity({
    email: parsed.data.email,
    username: parsed.data.username,
    phone: parsed.data.phone,
  });
  const password = parsed.data.password;
  const role = parsed.data.role;
  const branchIds = [...new Set(parsed.data.branchIds)];
  const defaultBranchId = parsed.data.defaultBranchId;

  try {
    const passwordHash = await argon2.hash(password);

    const createdUserName = await prisma.$transaction(async (tx) => {
      await assertUniqueUserIdentity({
        tx,
        email: identity.email,
        username: identity.username,
        normalizedPhone: identity.normalizedPhone,
      });

      const branches = await validateAssignedBranches(tx, branchIds);
      const defaultBranch = branches.find((branch) => branch.id === defaultBranchId);

      if (!defaultBranch) {
        throw new Error("Default branch must be assigned to the user.");
      }

      const user = await tx.user.create({
        data: {
          name,
          email: identity.email,
          phone: identity.phone,
          username: identity.username,
          displayUsername: identity.displayUsername,
          displayName: name,
          role,
          isActive: true,
          defaultBranchId: defaultBranch.id,
          branchAssignments: {
            create: buildBranchAssignments(branchIds, defaultBranch.id),
          },
        },
        select: {
          id: true,
          name: true,
        },
      });

      await tx.account.create({
        data: {
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: passwordHash,
        },
      });

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: "USER_CREATE",
        entityType: "User",
        entityId: user.id,
        branchId: defaultBranch.id,
        after: {
          name,
          email: identity.email,
          phone: identity.phone,
          username: identity.displayUsername,
          role,
          defaultBranchId: defaultBranch.id,
          assignedBranchIds: branchIds,
          isActive: true,
        },
      });

      return user.name;
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/roles");

    return {
      success: true,
      message: `${createdUserName} created successfully.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(error, "Unable to create the user right now."),
    };
  }
}

export async function updateUserAction(
  input: UserUpdateInput,
): Promise<ActionResult> {
  const actor = await getActionActor(["ADMIN"]);

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to update users.",
    };
  }

  const parsed = userUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "User details are invalid.",
    };
  }

  const name = parsed.data.name.trim();
  const identity = resolveUserIdentity({
    email: parsed.data.email,
    username: parsed.data.username,
    phone: parsed.data.phone,
  });
  const password = parsed.data.password?.trim() ?? "";
  const role = parsed.data.role;
  const branchIds = [...new Set(parsed.data.branchIds)];
  const defaultBranchId = parsed.data.defaultBranchId;

  try {
    const updatedUserName = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: {
          id: parsed.data.id,
        },
        select: {
          id: true,
          name: true,
          defaultBranchId: true,
        },
      });

      if (!user) {
        throw new Error("Selected user was not found.");
      }

      await assertUniqueUserIdentity({
        tx,
        email: identity.email,
        username: identity.username,
        normalizedPhone: identity.normalizedPhone,
        ignoreUserId: user.id,
      });

      const branches = await validateAssignedBranches(tx, branchIds);
      const defaultBranch = branches.find((branch) => branch.id === defaultBranchId);

      if (!defaultBranch) {
        throw new Error("Default branch must be assigned to the user.");
      }

      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          name,
          displayName: name,
          email: identity.email,
          phone: identity.phone,
          username: identity.username,
          displayUsername: identity.displayUsername,
          role,
          defaultBranchId: defaultBranch.id,
        },
      });

      await tx.userBranch.deleteMany({
        where: {
          userId: user.id,
          branchId: {
            notIn: branchIds,
          },
        },
      });

      for (const assignment of buildBranchAssignments(branchIds, defaultBranch.id)) {
        await tx.userBranch.upsert({
          where: {
            userId_branchId: {
              userId: user.id,
              branchId: assignment.branchId,
            },
          },
          update: {
            isActive: true,
            isDefault: assignment.isDefault,
          },
          create: {
            userId: user.id,
            branchId: assignment.branchId,
            isActive: true,
            isDefault: assignment.isDefault,
          },
        });
      }

      await tx.session.updateMany({
        where: {
          userId: user.id,
          OR: [
            { activeBranchId: null },
            {
              activeBranchId: {
                notIn: branchIds,
              },
            },
          ],
        },
        data: {
          activeBranchId: defaultBranch.id,
        },
      });

      if (password) {
        const passwordHash = await argon2.hash(password);
        const credentialAccount = await tx.account.findFirst({
          where: {
            userId: user.id,
            providerId: "credential",
          },
          select: {
            id: true,
          },
        });

        if (credentialAccount) {
          await tx.account.update({
            where: {
              id: credentialAccount.id,
            },
            data: {
              password: passwordHash,
            },
          });
        } else {
          await tx.account.create({
            data: {
              accountId: user.id,
              providerId: "credential",
              userId: user.id,
              password: passwordHash,
            },
          });
        }
      }

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: "USER_UPDATE",
        entityType: "User",
        entityId: user.id,
        branchId: defaultBranch.id,
        after: {
          name,
          email: identity.email,
          phone: identity.phone,
          username: identity.displayUsername,
          role,
          defaultBranchId: defaultBranch.id,
          assignedBranchIds: branchIds,
        },
      });

      return name;
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/roles");

    return {
      success: true,
      message: `${updatedUserName} updated successfully.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(error, "Unable to update the user right now."),
    };
  }
}

export async function setUserActiveStateAction(
  input: UserStatusInput,
): Promise<ActionResult> {
  const actor = await getActionActor(["ADMIN"]);

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to change user status.",
    };
  }

  const parsed = userStatusSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "User status is invalid.",
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await getManagedUser(tx, parsed.data.userId);

      if (!user) {
        throw new Error("Selected user was not found.");
      }

      if (isArchivedUsername(user.username)) {
        throw new Error("Deleted users cannot be activated or deactivated.");
      }

      if (!parsed.data.isActive) {
        await ensureUserCanBeDisabledOrDeleted({
          tx,
          actorId: actor.id,
          user,
          action: "deactivate",
        });
      }

      if (user.isActive === parsed.data.isActive) {
        return {
          name: getManagedUserName(user),
          isActive: user.isActive,
        };
      }

      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          isActive: parsed.data.isActive,
        },
      });

      if (!parsed.data.isActive) {
        await tx.session.deleteMany({
          where: {
            userId: user.id,
          },
        });
      }

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: parsed.data.isActive ? "USER_ACTIVATE" : "USER_DEACTIVATE",
        entityType: "User",
        entityId: user.id,
        ...(user.defaultBranchId ? { branchId: user.defaultBranchId } : {}),
        before: {
          isActive: user.isActive,
        },
        after: {
          isActive: parsed.data.isActive,
        },
      });

      return {
        name: getManagedUserName(user),
        isActive: parsed.data.isActive,
      };
    });

    revalidatePath("/admin/users");

    return {
      success: true,
      message: `${result.name} is now ${result.isActive ? "active" : "inactive"}.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(
        error,
        "Unable to change the user status right now.",
      ),
    };
  }
}

export async function deleteUserAction(
  input: UserDeleteInput,
): Promise<ActionResult> {
  const actor = await getActionActor(["ADMIN"]);

  if (!actor) {
    return {
      success: false,
      message: "You are not allowed to delete users.",
    };
  }

  const parsed = userDeleteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ?? "User delete request is invalid.",
    };
  }

  try {
    const deletedUserName = await prisma.$transaction(async (tx) => {
      const user = await getManagedUser(tx, parsed.data.userId);

      if (!user) {
        throw new Error("Selected user was not found.");
      }

      if (isArchivedUsername(user.username)) {
        throw new Error("This user has already been deleted.");
      }

      await ensureUserCanBeDisabledOrDeleted({
        tx,
        actorId: actor.id,
        user,
        action: "delete",
      });

      const displayName = getManagedUserName(user);
      const displayUsername = getUserDisplayUsername(user);
      const loginLabel = getUserLoginLabel(user);

      await tx.session.deleteMany({
        where: {
          userId: user.id,
        },
      });

      await tx.account.deleteMany({
        where: {
          userId: user.id,
        },
      });

      await tx.userBranch.deleteMany({
        where: {
          userId: user.id,
        },
      });

      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          isActive: false,
          email: null,
          phone: null,
          username: buildArchivedUsername(user.id),
          displayUsername: displayUsername || null,
          displayName,
          defaultBranchId: null,
        },
      });

      await createAuditLog(tx, {
        actorUserId: actor.id,
        action: "USER_DELETE",
        entityType: "User",
        entityId: user.id,
        ...(user.defaultBranchId ? { branchId: user.defaultBranchId } : {}),
        before: {
          name: displayName,
          username: displayUsername || loginLabel,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isActive: user.isActive,
        },
        after: {
          archived: true,
          isActive: false,
        },
      });

      return displayName;
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/roles");

    return {
      success: true,
      message: `${deletedUserName} was deleted. Past activity has been kept in history.`,
    };
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(error, "Unable to delete the user right now."),
    };
  }
}
