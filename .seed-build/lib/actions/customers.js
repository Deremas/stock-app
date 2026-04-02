"use server";
import { revalidatePath } from "next/cache";
import { getActionActor, getActionErrorMessage, normalizeOptionalString, } from "@/lib/actions/common";
import { prisma } from "@/lib/prisma";
import { customerCreateSchema, } from "@/lib/validation/customer";
export async function createCustomerAction(input) {
    const actor = await getActionActor(["ADMIN", "SALES"]);
    if (!actor) {
        return {
            success: false,
            message: "You are not allowed to create customers.",
        };
    }
    const parsed = customerCreateSchema.safeParse(input);
    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Customer details are invalid.",
        };
    }
    try {
        const phone = normalizeOptionalString(parsed.data.phone);
        const location = normalizeOptionalString(parsed.data.location);
        const note = normalizeOptionalString(parsed.data.note);
        const customer = await prisma.customer.create({
            data: {
                name: parsed.data.name,
                ...(phone ? { phone } : {}),
                ...(location ? { address: location } : {}),
                ...(note ? { note } : {}),
            },
            select: {
                id: true,
                name: true,
            },
        });
        revalidatePath("/sales/customers");
        revalidatePath("/sales/new");
        revalidatePath("/sales/sales-list");
        revalidatePath("/sales");
        return {
            success: true,
            message: `${customer.name} was added successfully.`,
            customer,
        };
    }
    catch (error) {
        return {
            success: false,
            message: getActionErrorMessage(error, "Unable to create the customer right now."),
        };
    }
}
