"use server";
import { revalidatePath } from "next/cache";
import { getActionActorByPermission, getActionErrorMessage, normalizeOptionalString, } from "@/lib/actions/common";
import { prisma } from "@/lib/prisma";
import { supplierCreateSchema } from "@/lib/validation/supplier";
export async function createSupplierAction(input) {
    const actor = await getActionActorByPermission("suppliers:manage");
    if (!actor) {
        return {
            success: false,
            message: "You are not allowed to create suppliers.",
        };
    }
    const parsed = supplierCreateSchema.safeParse(input);
    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Supplier details are invalid.",
        };
    }
    try {
        const normalizedPhone = normalizeOptionalString(parsed.data.phone);
        const location = normalizeOptionalString(parsed.data.location);
        const note = normalizeOptionalString(parsed.data.note);
        const supplier = await prisma.supplier.create({
            data: {
                name: parsed.data.name,
                ...(normalizedPhone
                    ? { phone: normalizedPhone }
                    : {}),
                ...(location ? { address: location } : {}),
                ...(note ? { note } : {}),
            },
            select: {
                id: true,
                name: true,
            },
        });
        revalidatePath("/purchases/suppliers");
        revalidatePath("/purchases/list");
        revalidatePath("/purchases/new");
        revalidatePath("/purchases");
        return {
            success: true,
            message: `${supplier.name} was added successfully.`,
            supplier,
        };
    }
    catch (error) {
        const message = getActionErrorMessage(error, "Unable to create the supplier right now.");
        if (message.toLowerCase().includes("unique")) {
            return {
                success: false,
                message: "A supplier with that name already exists.",
            };
        }
        return {
            success: false,
            message,
        };
    }
}
