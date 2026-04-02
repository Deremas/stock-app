"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormFeedback } from "@/components/forms/form-feedback";
import { createSupplierPaymentAction } from "@/lib/actions/supplier-payments";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { supplierPaymentSchema, } from "@/lib/validation/supplier-payment";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatFinanceAccountLabel } from "@/lib/finance-account-utils";
function getDefaultValues(options, initialSupplierId) {
    const defaultSupplier = options.suppliers.find((supplier) => supplier.id === initialSupplierId) ??
        options.suppliers[0];
    const supplierPurchases = options.outstandingPurchases.filter((purchase) => purchase.supplierId === defaultSupplier?.id);
    const defaultPurchase = supplierPurchases[0];
    return {
        supplierId: defaultSupplier?.id ?? "",
        purchaseId: defaultPurchase?.id ?? "",
        financeAccountId: "",
        settlementMode: "FULL",
        amount: defaultPurchase?.amountDue ?? 0,
        paymentDate: new Date().toISOString().slice(0, 16),
        note: "",
    };
}
export function SupplierPaymentForm({ options, initialSupplierId, }) {
    const createDialog = useCreateDialog();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [submitError, setSubmitError] = useState(null);
    const defaultValues = getDefaultValues(options, initialSupplierId);
    const form = useForm({
        resolver: zodResolver(supplierPaymentSchema),
        defaultValues,
    });
    const supplierId = form.watch("supplierId");
    const purchaseId = form.watch("purchaseId");
    const settlementMode = form.watch("settlementMode");
    const supplierPurchases = useMemo(() => options.outstandingPurchases.filter((purchase) => purchase.supplierId === supplierId), [options.outstandingPurchases, supplierId]);
    const selectedPurchase = supplierPurchases.find((purchase) => purchase.id === purchaseId) ?? supplierPurchases[0];
    const availableAccounts = useMemo(() => options.accounts.filter((account) => !selectedPurchase || !account.branchId || account.branchId === selectedPurchase.branchId), [options.accounts, selectedPurchase]);
    useEffect(() => {
        if (!supplierPurchases.some((purchase) => purchase.id === purchaseId)) {
            form.setValue("purchaseId", supplierPurchases[0]?.id ?? "", {
                shouldDirty: true,
            });
        }
    }, [form, purchaseId, supplierPurchases]);
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
            form.setValue("amount", selectedPurchase?.amountDue ?? 0, {
                shouldDirty: true,
            });
            return;
        }
        const currentAmount = Number(form.getValues("amount") || 0);
        if (!selectedPurchase) {
            form.setValue("amount", 0, { shouldDirty: true });
        }
        else if (currentAmount <= 0 || currentAmount > selectedPurchase.amountDue) {
            form.setValue("amount", selectedPurchase.amountDue, { shouldDirty: true });
        }
    }, [form, selectedPurchase, settlementMode]);
    function handleCancel() {
        setSubmitError(null);
        form.reset(defaultValues);
        createDialog?.close();
    }
    function onSubmit(values) {
        startTransition(async () => {
            setSubmitError(null);
            const result = await createSupplierPaymentAction(values);
            if (!result.success) {
                setSubmitError(result.message);
                toast.error(result.message);
                return;
            }
            setSubmitError(null);
            toast.success(result.message);
            form.reset(getDefaultValues(options, initialSupplierId));
            router.refresh();
            createDialog?.close();
        });
    }
    if (options.suppliers.length === 0 || options.outstandingPurchases.length === 0) {
        return (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "There are no outstanding supplier balances to pay right now." }), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { type: "button", variant: "outline", onClick: () => createDialog?.close(), children: "Close" }) })] }));
    }
    return (_jsxs("form", { className: "grid gap-6 xl:grid-cols-[2fr_1fr]", onChangeCapture: () => {
            if (submitError) {
                setSubmitError(null);
            }
        }, onSubmit: form.handleSubmit(onSubmit), children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Pay supplier balance" }) }), _jsxs(CardContent, { className: "space-y-6", children: [_jsx(FormFeedback, { errors: form.formState.errors, submitError: submitError, showValidationSummary: form.formState.submitCount > 0 }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "supplierId", children: "Supplier" }), _jsx(Select, { id: "supplierId", ...form.register("supplierId"), children: options.suppliers.map((supplier) => (_jsx("option", { value: supplier.id, children: supplier.name }, supplier.id))) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.supplierId?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "purchaseId", children: "Outstanding purchase" }), _jsx(Select, { id: "purchaseId", ...form.register("purchaseId"), children: supplierPurchases.map((purchase) => (_jsxs("option", { value: purchase.id, children: [purchase.purchaseNumber, " | ", purchase.branchName, " | ", formatCurrency(purchase.amountDue)] }, purchase.id))) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.purchaseId?.message })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "supplier-settlementMode", children: "Settlement mode" }), _jsxs(Select, { id: "supplier-settlementMode", ...form.register("settlementMode"), children: [_jsx("option", { value: "FULL", children: "Full payment" }), _jsx("option", { value: "PARTIAL", children: "Partial payment" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "supplier-financeAccountId", children: "Payment account" }), _jsx(Select, { id: "supplier-financeAccountId", ...form.register("financeAccountId"), children: availableAccounts.map((account) => (_jsx("option", { value: account.id, children: formatFinanceAccountLabel(account) }, account.id))) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.financeAccountId?.message })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "supplier-amount", children: "Amount" }), _jsx(Input, { id: "supplier-amount", type: "number", min: 0.01, step: "0.01", readOnly: settlementMode === "FULL", ...form.register("amount") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.amount?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "paymentDate", children: "Payment date" }), _jsx(Input, { id: "paymentDate", type: "datetime-local", ...form.register("paymentDate") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.paymentDate?.message })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "supplier-payment-note", children: "Note" }), _jsx(Textarea, { id: "supplier-payment-note", rows: 3, ...form.register("note") })] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Outstanding summary" }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "rounded-2xl bg-muted/60 p-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Selected purchase" }), _jsx("p", { className: "mt-2 text-lg font-semibold", children: selectedPurchase?.purchaseNumber ?? "No purchase selected" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: selectedPurchase
                                            ? `${selectedPurchase.branchName} | ${formatDateTime(selectedPurchase.purchasedAt)}`
                                            : "Choose an outstanding purchase to pay." })] }), _jsxs("div", { className: "rounded-2xl bg-muted/60 p-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Outstanding amount" }), _jsx("p", { className: "mt-2 text-3xl font-semibold", children: formatCurrency(selectedPurchase?.amountDue ?? 0) })] }), _jsxs("div", { className: "flex flex-col-reverse gap-2 sm:flex-row", children: [_jsx(Button, { type: "button", variant: "outline", className: "sm:flex-1", disabled: isPending, onClick: handleCancel, children: "Cancel" }), _jsx(Button, { className: "sm:flex-1", type: "submit", disabled: isPending, children: isPending ? "Saving..." : "Post payment" })] })] })] })] }));
}
