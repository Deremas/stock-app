"use server";
import { revalidatePath } from "next/cache";
import { LedgerDirection, LedgerEntryType, PaymentStatus } from "@/generated/prisma/enums";
import { createDocumentNumber, getActionActorByPermission, getActionErrorMessage, normalizeOptionalString, parseInputDate, toDecimal, } from "@/lib/actions/common";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { createAuditLog } from "@/lib/services/inventory-ledger";
import { customerPaymentSchema, } from "@/lib/validation/customer-payment";
export async function createCustomerPaymentAction(input) {
    const actor = await getActionActorByPermission("customer-payments:create");
    if (!actor) {
        return {
            success: false,
            message: "You are not allowed to record customer payments.",
        };
    }
    const parsed = customerPaymentSchema.safeParse(input);
    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Customer payment details are invalid.",
        };
    }
    const paymentDate = parseInputDate(parsed.data.paymentDate);
    if (!paymentDate) {
        return {
            success: false,
            message: "Payment date is invalid.",
        };
    }
    const note = normalizeOptionalString(parsed.data.note);
    if (!hasPermission(actor.role, "accounts:use")) {
        return {
            success: false,
            message: "You are not allowed to use payment accounts for customer payments.",
        };
    }
    try {
        const paymentReference = await prisma.$transaction(async (tx) => {
            const sale = await tx.sale.findFirst({
                where: {
                    id: parsed.data.saleId,
                    customerId: parsed.data.customerId,
                    status: "COMPLETED",
                },
                select: {
                    id: true,
                    saleNumber: true,
                    customerId: true,
                    branchId: true,
                    amountDue: true,
                    amountPaid: true,
                },
            });
            if (!sale || !sale.customerId) {
                throw new Error("Selected credit sale was not found.");
            }
            const customer = await tx.customer.findFirst({
                where: {
                    id: parsed.data.customerId,
                    isActive: true,
                },
                select: {
                    id: true,
                    name: true,
                },
            });
            if (!customer) {
                throw new Error("Selected customer was not found.");
            }
            const financeAccount = await tx.financeAccount.findFirst({
                where: {
                    id: parsed.data.financeAccountId,
                    isActive: true,
                },
                select: {
                    id: true,
                    name: true,
                    branchId: true,
                },
            });
            if (!financeAccount) {
                throw new Error("Selected payment account was not found.");
            }
            if (financeAccount.branchId && financeAccount.branchId !== sale.branchId) {
                throw new Error("Payment account must belong to the same branch as the credit sale.");
            }
            const currentDue = Number(sale.amountDue);
            if (currentDue <= 0) {
                throw new Error("This sale has no outstanding balance left to settle.");
            }
            const amount = parsed.data.settlementMode === "FULL" ? currentDue : parsed.data.amount;
            if (amount > currentDue) {
                throw new Error("Payment amount cannot exceed the outstanding balance.");
            }
            const nextAmountDue = Math.max(0, Number((currentDue - amount).toFixed(2)));
            const nextAmountPaid = Number((Number(sale.amountPaid) + amount).toFixed(2));
            const paymentStatus = nextAmountDue === 0 ? PaymentStatus.PAID : PaymentStatus.PARTIAL;
            const paymentNumber = createDocumentNumber("CPM", paymentDate);
            const payment = await tx.customerPayment.create({
                data: {
                    paymentNumber,
                    customerId: customer.id,
                    saleId: sale.id,
                    branchId: sale.branchId,
                    financeAccountId: financeAccount.id,
                    recordedById: actor.id,
                    amount: toDecimal(amount),
                    paymentDate,
                    ...(note ? { note } : {}),
                },
                select: {
                    id: true,
                    paymentNumber: true,
                },
            });
            await tx.sale.update({
                where: {
                    id: sale.id,
                },
                data: {
                    amountPaid: toDecimal(nextAmountPaid),
                    amountDue: toDecimal(nextAmountDue),
                    paymentStatus,
                },
            });
            await tx.ledgerEntry.create({
                data: {
                    entryDate: paymentDate,
                    branchId: sale.branchId,
                    financeAccountId: financeAccount.id,
                    direction: LedgerDirection.DEBIT,
                    amount: toDecimal(amount),
                    entryType: LedgerEntryType.CUSTOMER_PAYMENT,
                    referenceType: "CustomerPayment",
                    referenceId: payment.id,
                    description: `Customer payment ${payment.paymentNumber} for ${sale.saleNumber}`,
                },
            });
            await createAuditLog(tx, {
                actorUserId: actor.id,
                action: "CUSTOMER_PAYMENT",
                entityType: "CustomerPayment",
                entityId: payment.id,
                branchId: sale.branchId,
                after: {
                    paymentNumber: payment.paymentNumber,
                    customerId: customer.id,
                    customerName: customer.name,
                    saleId: sale.id,
                    saleNumber: sale.saleNumber,
                    amount,
                    settlementMode: parsed.data.settlementMode,
                    remainingDue: nextAmountDue,
                    financeAccountId: financeAccount.id,
                    financeAccountName: financeAccount.name,
                },
            });
            return payment.paymentNumber;
        });
        revalidatePath("/sales/customers");
        revalidatePath("/sales/customer-credit");
        revalidatePath("/sales/customer-payments");
        revalidatePath("/sales/sales-list");
        revalidatePath("/finance/accounts");
        revalidatePath("/finance/cash");
        revalidatePath("/finance/ledger");
        revalidatePath("/dashboard");
        return {
            success: true,
            message: `Customer payment ${paymentReference} posted successfully.`,
        };
    }
    catch (error) {
        return {
            success: false,
            message: getActionErrorMessage(error, "Unable to record the customer payment right now."),
        };
    }
}
