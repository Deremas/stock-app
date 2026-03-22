"use server";

import argon2 from "argon2";
import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/actions/common";
import { getActionActor, getActionErrorMessage } from "@/lib/actions/common";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/inventory-ledger";
import {
  userSchema,
  userUpdateSchema,
  type UserInput,
  type UserUpdateInput,
} from "@/lib/validation/user";

function normalizePhoneIdentifier(value: string) {
  return value.replace(/\D/g, "");
}

async function validateAssignedBranches(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
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
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  email: string;
  username: string;
  normalizedPhone: string;
  ignoreUserId?: string;
}) {
  const [existingEmail, existingUsername, existingPhoneUsers] = await Promise.all([
    args.tx.user.findFirst({
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
    }),
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
    args.tx.user.findMany({
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
    }),
  ]);

  if (existingEmail) {
    throw new Error("A user with that email already exists.");
  }

  if (existingUsername) {
    throw new Error("That username is already taken.");
  }

  const duplicatePhone = existingPhoneUsers.find(
    (user) => normalizePhoneIdentifier(user.phone ?? "") === args.normalizedPhone,
  );

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
  const email = parsed.data.email.trim().toLowerCase();
  const username = parsed.data.username.trim().toLowerCase();
  const displayUsername = parsed.data.username.trim();
  const phone = parsed.data.phone.trim();
  const normalizedPhone = normalizePhoneIdentifier(phone);
  const password = parsed.data.password;
  const role = parsed.data.role;
  const branchIds = [...new Set(parsed.data.branchIds)];
  const defaultBranchId = parsed.data.defaultBranchId;

  try {
    const passwordHash = await argon2.hash(password);

    const createdUserName = await prisma.$transaction(async (tx) => {
      await assertUniqueUserIdentity({
        tx,
        email,
        username,
        normalizedPhone,
      });

      const branches = await validateAssignedBranches(tx, branchIds);
      const defaultBranch = branches.find((branch) => branch.id === defaultBranchId);

      if (!defaultBranch) {
        throw new Error("Default branch must be assigned to the user.");
      }

      const user = await tx.user.create({
        data: {
          name,
          email,
          phone,
          username,
          displayUsername,
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
          email,
          phone,
          username,
          role,
          defaultBranchId: defaultBranch.id,
          assignedBranchIds: branchIds,
          isActive: true,
        },
      });

      return user.name;
    });

    revalidatePath("/admin/users");

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
  const email = parsed.data.email.trim().toLowerCase();
  const username = parsed.data.username.trim().toLowerCase();
  const displayUsername = parsed.data.username.trim();
  const phone = parsed.data.phone.trim();
  const normalizedPhone = normalizePhoneIdentifier(phone);
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
        email,
        username,
        normalizedPhone,
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
          email,
          phone,
          username,
          displayUsername,
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
          email,
          phone,
          username,
          role,
          defaultBranchId: defaultBranch.id,
          assignedBranchIds: branchIds,
        },
      });

      return name;
    });

    revalidatePath("/admin/users");

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
