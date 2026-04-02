"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createCashTransferAction } from "@/lib/actions/cash-transfers";
import { formatFinanceAccountLabel } from "@/lib/finance-account-utils";
import { formatCurrency } from "@/lib/utils";
import { cashTransferSchema, } from "@/lib/validation/cash-transfer";
function getDefaultValues(options, initialCashAccountId) {
    const selectedCashAccount = options.cashAccounts.find((account) => account.id === initialCashAccountId) ??
        options.cashAccounts[0];
    const branchId = selectedCashAccount?.branchId ?? options.branches[0]?.id ?? "";
    const branchBankAccount = options.bankAccounts.find((account) => account.branchId === branchId) ??
        options.bankAccounts[0];
    return {
        branchId,
        fromAccountId: selectedCashAccount?.id ?? "",
        toAccountId: branchBankAccount?.id ?? "",
        amount: 0,
        transferDate: new Date().toISOString().slice(0, 16),
        note: "",
    };
}
export function CashTransferForm({ options, initialCashAccountId, }) {
    const createDialog = useCreateDialog();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [submitError, setSubmitError] = useState(null);
    const defaultValues = getDefaultValues(options, initialCashAccountId);
    const form = useForm({
        resolver: zodResolver(cashTransferSchema),
        defaultValues,
    });
    const branchId = form.watch("branchId");
    const fromAccountId = form.watch("fromAccountId");
    const cashAccounts = useMemo(() => options.cashAccounts.filter((account) => account.branchId === branchId), [branchId, options.cashAccounts]);
    const bankAccounts = useMemo(() => options.bankAccounts.filter((account) => account.branchId === branchId), [branchId, options.bankAccounts]);
    const selectedCashAccount = cashAccounts.find((account) => account.id === fromAccountId) ?? cashAccounts[0];
    useEffect(() => {
        if (!cashAccounts.some((account) => account.id === fromAccountId)) {
            form.setValue("fromAccountId", cashAccounts[0]?.id ?? "", {
                shouldDirty: true,
            });
        }
    }, [cashAccounts, form, fromAccountId]);
    useEffect(() => {
        const toAccountId = form.getValues("toAccountId");
        if (!bankAccounts.some((account) => account.id === toAccountId)) {
            form.setValue("toAccountId", bankAccounts[0]?.id ?? "", {
                shouldDirty: true,
            });
        }
    }, [bankAccounts, form]);
    useEffect(() => {
        const amount = Number(form.getValues("amount") || 0);
        const maxAmount = selectedCashAccount?.balance ?? 0;
        if (amount > maxAmount) {
            form.setValue("amount", maxAmount, { shouldDirty: true });
        }
    }, [form, selectedCashAccount]);
    function handleCancel() {
        setSubmitError(null);
        form.reset(getDefaultValues(options, initialCashAccountId));
        createDialog?.close();
    }
    function onSubmit(values) {
        startTransition(async () => {
            setSubmitError(null);
            const result = await createCashTransferAction(values);
            if (!result.success) {
                setSubmitError(result.message);
                toast.error(result.message);
                return;
            }
            toast.success(result.message);
            form.reset(getDefaultValues(options, initialCashAccountId));
            router.refresh();
            createDialog?.close();
        });
    }
    if (options.cashAccounts.length === 0 || options.bankAccounts.length === 0) {
        return (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Create at least one cash account and one bank account before posting a deposit." }), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { type: "button", variant: "outline", onClick: () => createDialog?.close(), children: "Close" }) })] }));
    }
    return (_jsxs("form", { className: "grid gap-6 xl:grid-cols-[2fr_1fr]", onChangeCapture: () => {
            if (submitError) {
                setSubmitError(null);
            }
        }, onSubmit: form.handleSubmit(onSubmit), children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Deposit cash to bank" }) }), _jsxs(CardContent, { className: "space-y-6", children: [_jsx(FormFeedback, { errors: form.formState.errors, submitError: submitError, showValidationSummary: form.formState.submitCount > 0 }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "cash-transfer-branch", children: "Branch" }), _jsx(Select, { id: "cash-transfer-branch", ...form.register("branchId"), children: options.branches.map((branch) => (_jsxs("option", { value: branch.id, children: [branch.code, " - ", branch.name] }, branch.id))) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.branchId?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "cash-transfer-date", children: "Transfer date" }), _jsx(Input, { id: "cash-transfer-date", type: "datetime-local", ...form.register("transferDate") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.transferDate?.message })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "cash-transfer-from", children: "Cash account" }), _jsx(Select, { id: "cash-transfer-from", ...form.register("fromAccountId"), children: cashAccounts.map((account) => (_jsxs("option", { value: account.id, children: [formatFinanceAccountLabel(account), " | ", formatCurrency(account.balance)] }, account.id))) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.fromAccountId?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "cash-transfer-to", children: "Bank account" }), _jsx(Select, { id: "cash-transfer-to", ...form.register("toAccountId"), children: bankAccounts.map((account) => (_jsx("option", { value: account.id, children: formatFinanceAccountLabel(account) }, account.id))) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.toAccountId?.message })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "cash-transfer-amount", children: "Amount" }), _jsx(Input, { id: "cash-transfer-amount", type: "number", min: 0.01, max: selectedCashAccount?.balance ?? undefined, step: "0.01", ...form.register("amount") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.amount?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "cash-transfer-note", children: "Note" }), _jsx(Textarea, { id: "cash-transfer-note", rows: 3, ...form.register("note") })] })] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Available cash" }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "rounded-2xl bg-muted/60 p-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Selected cash balance" }), _jsx("p", { className: "mt-2 text-3xl font-semibold", children: formatCurrency(selectedCashAccount?.balance ?? 0) })] }), _jsx("div", { className: "rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground", children: "Deposits post two ledger entries: cash is credited and the destination bank account is debited by the same amount." }), _jsxs("div", { className: "flex flex-col-reverse gap-2 sm:flex-row", children: [_jsx(Button, { type: "button", variant: "outline", className: "sm:flex-1", disabled: isPending, onClick: handleCancel, children: "Cancel" }), _jsx(Button, { className: "sm:flex-1", type: "submit", disabled: isPending, children: isPending ? "Saving..." : "Post deposit" })] })] })] })] }));
}
