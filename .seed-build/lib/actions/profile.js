"use server";
import argon2 from "argon2";
import { revalidatePath } from "next/cache";
import { getActionActor, getActionErrorMessage } from "@/lib/actions/common";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/inventory-ledger";
import { profileNameSchema, profilePasswordSchema, } from "@/lib/validation/profile";
export async function updateOwnProfileAction(input) {
    const actor = await getActionActor(["ADMIN", "SALES"]);
    if (!actor) {
        return {
            success: false,
            message: "You are not allowed to update this profile.",
        };
    }
    const parsed = profileNameSchema.safeParse(input);
    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Profile details are invalid.",
        };
    }
    const name = parsed.data.name.trim();
    try {
        const result = await prisma.$transaction(async (tx) => {
            const existingUser = await tx.user.findUnique({
                where: { id: actor.id },
                select: {
                    id: true,
                    name: true,
                    displayName: true,
                },
            });
            if (!existingUser) {
                throw new Error("User not found.");
            }
            if ((existingUser.displayName ?? existingUser.name) === name) {
                return { changed: false, name };
            }
            await tx.user.update({
                where: { id: actor.id },
                data: {
                    name,
                    displayName: name,
                },
            });
            await createAuditLog(tx, {
                actorUserId: actor.id,
                action: "USER_SELF_UPDATE",
                entityType: "User",
                entityId: actor.id,
                after: {
                    name,
                },
            });
            return { changed: true, name };
        });
        revalidatePath("/profile");
        revalidatePath("/dashboard");
        revalidatePath("/");
        return {
            success: true,
            message: result.changed
                ? "Profile updated successfully."
                : "No changes to save.",
        };
    }
    catch (error) {
        return {
            success: false,
            message: getActionErrorMessage(error, "Unable to update your profile right now."),
        };
    }
}
export async function changeOwnPasswordAction(input) {
    const actor = await getActionActor(["ADMIN", "SALES"]);
    if (!actor) {
        return {
            success: false,
            message: "You are not allowed to update this password.",
        };
    }
    const parsed = profilePasswordSchema.safeParse(input);
    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Password details are invalid.",
        };
    }
    try {
        await prisma.$transaction(async (tx) => {
            const account = await tx.account.findFirst({
                where: {
                    userId: actor.id,
                    providerId: "credential",
                },
                select: {
                    id: true,
                    password: true,
                },
            });
            if (!account?.password) {
                throw new Error("Password login is not available for this account.");
            }
            const validPassword = await argon2.verify(account.password, parsed.data.currentPassword);
            if (!validPassword) {
                throw new Error("Current password is incorrect.");
            }
            const newHash = await argon2.hash(parsed.data.newPassword);
            await tx.account.update({
                where: {
                    id: account.id,
                },
                data: {
                    password: newHash,
                },
            });
            await createAuditLog(tx, {
                actorUserId: actor.id,
                action: "USER_PASSWORD_CHANGE",
                entityType: "User",
                entityId: actor.id,
            });
        });
        revalidatePath("/profile");
        return {
            success: true,
            message: "Password updated successfully.",
        };
    }
    catch (error) {
        return {
            success: false,
            message: getActionErrorMessage(error, "Unable to update your password right now."),
        };
    }
}
