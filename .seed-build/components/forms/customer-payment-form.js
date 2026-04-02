"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createCustomerPaymentAction } from "@/lib/actions/customer-payments";
import { FormFeedback } from "@/components/forms/form-feedback";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { customerPaymentSchema, } from "@/lib/validation/customer-payment";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatFinanceAccountLabel } from "@/lib/finance-account-utils";
function getDefaultValues(options, initialCustomerId, initialSettlementMode = "FULL") {
    const defaultCustomer = options.customers.find((customer) => customer.id === initialCustomerId) ??
        options.customers[0];
    const customerSales = options.outstandingSales.filter((sale) => sale.customerId === defaultCustomer?.id);
    const defaultSale = customerSales[0];
    return {
        customerId: defaultCustomer?.id ?? "",
        saleId: defaultSale?.id ?? "",
        financeAccountId: "",
        settlementMode: initialSettlementMode,
        amount: defaultSale?.amountDue ?? 0,
        paymentDate: new Date().toISOString().slice(0, 16),
        note: "",
    };
}
export function CustomerPaymentForm({ options, initialCustomerId, initialSettlementMode = "FULL", }) {
    const createDialog = useCreateDialog();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [submitError, setSubmitError] = useState(null);
    const defaultValues = getDefaultValues(options, initialCustomerId, initialSettlementMode);
    const form = useForm({
        resolver: zodResolver(customerPaymentSchema),
        defaultValues,
    });
    const customerId = form.watch("customerId");
    const saleId = form.watch("saleId");
    const settlementMode = form.watch("settlementMode");
    const customerSales = useMemo(() => options.outstandingSales.filter((sale) => sale.customerId === customerId), [customerId, options.outstandingSales]);
    const selectedSale = customerSales.find((sale) => sale.id === saleId) ?? customerSales[0];
    const availableAccounts = useMemo(() => options.accounts.filter((account) => !selectedSale || !account.branchId || account.branchId === selectedSale.branchId), [options.accounts, selectedSale]);
    useEffect(() => {
        if (!customerSales.some((sale) => sale.id === saleId)) {
            form.setValue("saleId", customerSales[0]?.id ?? "", {
                shouldDirty: true,
            });
        }
    }, [customerSales, form, saleId]);
    useEffect(() => {
        const financeAccountId = form.getValues("financeAccountId");
        if (!availableAccounts.some((account) => account.id === financeAccountId)) {
            form.setValue("financeAccountId", availableAccounts[0]?.id ?? "", {
                shouldDirty: true,
            });
        }
    }, [availableAccounts, form]);
    useEffect(() => {
        if (settlementMode === "FULL") {
            form.setValue("amount", selectedSale?.amountDue ?? 0, {
                shouldDirty: true,
            });
            return;
        }
        const currentAmount = Number(form.getValues("amount") || 0);
        if (!selectedSale) {
            form.setValue("amount", 0, { shouldDirty: true });
        }
        else if (currentAmount <= 0 || currentAmount > selectedSale.amountDue) {
            form.setValue("amount", selectedSale.amountDue, { shouldDirty: true });
        }
    }, [form, selectedSale, settlementMode]);
    function handleCancel() {
        setSubmitError(null);
        form.reset(defaultValues);
        createDialog?.close();
    }
    function onSubmit(values) {
        startTransition(async () => {
            setSubmitError(null);
            const result = await createCustomerPaymentAction(values);
            if (!result.success) {
                setSubmitError(result.message);
                toast.error(result.message);
                return;
            }
            setSubmitError(null);
            toast.success(result.message);
            form.reset(getDefaultValues(options, initialCustomerId, initialSettlementMode));
            router.refresh();
            createDialog?.close();
        });
    }
    if (options.customers.length === 0 || options.outstandingSales.length === 0) {
        return (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "There are no outstanding customer credit balances to settle right now." }), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { type: "button", variant: "outline", onClick: () => createDialog?.close(), children: "Close" }) })] }));
    }
    return (_jsxs("form", { className: "grid gap-6 xl:grid-cols-[2fr_1fr]", onChangeCapture: () => {
            if (submitError) {
                setSubmitError(null);
            }
        }, onSubmit: form.handleSubmit(onSubmit), children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Settle customer credit" }) }), _jsxs(CardContent, { className: "space-y-6", children: [_jsx(FormFeedback, { errors: form.formState.errors, submitError: submitError, showValidationSummary: form.formState.submitCount > 0 }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "customerId", children: "Customer" }), _jsx(Select, { id: "customerId", ...form.register("customerId"), children: options.customers.map((customer) => (_jsx("option", { value: customer.id, children: customer.name }, customer.id))) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.customerId?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "saleId", children: "Credit sale" }), _jsx(Select, { id: "saleId", ...form.register("saleId"), children: customerSales.map((sale) => (_jsxs("option", { value: sale.id, children: [sale.saleNumber, " | ", sale.branchName, " | ", formatCurrency(sale.amountDue)] }, sale.id))) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.saleId?.message })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "settlementMode", children: "Settlement mode" }), _jsxs(Select, { id: "settlementMode", ...form.register("settlementMode"), children: [_jsx("option", { value: "FULL", children: "Full settlement" }), _jsx("option", { value: "PARTIAL", children: "Partial settlement" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "financeAccountId", children: "Payment account" }), _jsx(Select, { id: "financeAccountId", ...form.register("financeAccountId"), children: availableAccounts.map((account) => (_jsx("option", { value: account.id, children: formatFinanceAccountLabel(account) }, account.id))) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.financeAccountId?.message })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "amount", children: "Amount" }), _jsx(Input, { id: "amount", type: "number", min: 0.01, step: "0.01", readOnly: settlementMode === "FULL", ...form.register("amount") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.amount?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "paymentDate", children: "Payment date" }), _jsx(Input, { id: "paymentDate", type: "datetime-local", ...form.register("paymentDate") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.paymentDate?.message })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "customer-payment-note", children: "Note" }), _jsx(Textarea, { id: "customer-payment-note", rows: 3, ...form.register("note") })] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Outstanding summary" }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "rounded-2xl bg-muted/60 p-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Selected sale" }), _jsx("p", { className: "mt-2 text-lg font-semibold", children: selectedSale?.saleNumber ?? "No sale selected" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: selectedSale
                                            ? `${selectedSale.branchName} | ${formatDateTime(selectedSale.soldAt)}`
                                            : "Choose a credit sale to settle." })] }), _jsxs("div", { className: "rounded-2xl bg-muted/60 p-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Outstanding amount" }), _jsx("p", { className: "mt-2 text-3xl font-semibold", children: formatCurrency(selectedSale?.amountDue ?? 0) })] }), _jsxs("div", { className: "flex flex-col-reverse gap-2 sm:flex-row", children: [_jsx(Button, { type: "button", variant: "outline", className: "sm:flex-1", disabled: isPending, onClick: handleCancel, children: "Cancel" }), _jsx(Button, { className: "sm:flex-1", type: "submit", disabled: isPending, children: isPending ? "Saving..." : "Post payment" })] })] })] })] }));
}
