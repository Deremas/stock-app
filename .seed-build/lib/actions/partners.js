"use server";
import { revalidatePath } from "next/cache";
import { getActionActorByPermission, getActionErrorMessage, normalizeOptionalString, } from "@/lib/actions/common";
import { prisma } from "@/lib/prisma";
import { partnerCreateSchema, } from "@/lib/validation/partner";
export async function createPartnerAction(input) {
    const actor = await getActionActorByPermission("sellers:manage");
    if (!actor) {
        return {
            success: false,
            message: "You are not allowed to create partners.",
        };
    }
    const parsed = partnerCreateSchema.safeParse(input);
    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Partner details are invalid.",
        };
    }
    try {
        const phone = normalizeOptionalString(parsed.data.phone);
        const location = normalizeOptionalString(parsed.data.location);
        const note = normalizeOptionalString(parsed.data.note);
        const partner = await prisma.seller.create({
            data: {
                fullName: parsed.data.fullName,
                ...(phone ? { phone } : {}),
                ...(location ? { address: location } : {}),
                ...(note ? { note } : {}),
            },
            select: {
                id: true,
                fullName: true,
            },
        });
        revalidatePath("/sellers/list");
        revalidatePath("/sellers/new-intake");
        revalidatePath("/sellers/assign-items");
        revalidatePath("/sellers");
        return {
            success: true,
            message: `${partner.fullName} was added successfully.`,
            partner: {
                id: partner.id,
                name: partner.fullName,
            },
        };
    }
    catch (error) {
        const message = getActionErrorMessage(error, "Unable to create the partner right now.");
        if (message.toLowerCase().includes("unique")) {
            return {
                success: false,
                message: "A partner with that phone number already exists.",
            };
        }
        return {
            success: false,
            message,
        };
    }
}
