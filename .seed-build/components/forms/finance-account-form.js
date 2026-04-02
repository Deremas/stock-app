"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useTransition } from "react";
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
import { createFinanceAccountAction } from "@/lib/actions/finance-accounts";
import { financeAccountSchema, } from "@/lib/validation/finance-account";
function getDefaultValues(options) {
    return {
        branchId: options.branches[0]?.id ?? "",
        type: "BANK",
        name: "",
        bankName: "",
        accountNumber: "",
        initialBalance: 0,
    };
}
export function FinanceAccountForm({ options }) {
    const createDialog = useCreateDialog();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [submitError, setSubmitError] = useState(null);
    const defaultValues = getDefaultValues(options);
    const form = useForm({
        resolver: zodResolver(financeAccountSchema),
        defaultValues,
    });
    const type = form.watch("type");
    const branchId = form.watch("branchId");
    const branchHasCashAccount = options.cashBranchIds.includes(branchId);
    const canSubmit = !(type === "CASH" && branchHasCashAccount);
    useEffect(() => {
        if (type === "CASH") {
            form.setValue("name", "Cash", { shouldDirty: true });
            form.setValue("bankName", "", { shouldDirty: true });
            form.setValue("accountNumber", "", { shouldDirty: true });
        }
    }, [form, type]);
    function handleCancel() {
        setSubmitError(null);
        form.reset(defaultValues);
        createDialog?.close();
    }
    function onSubmit(values) {
        startTransition(async () => {
            setSubmitError(null);
            const result = await createFinanceAccountAction(values);
            if (!result.success) {
                setSubmitError(result.message);
                toast.error(result.message);
                return;
            }
            toast.success(result.message);
            form.reset(getDefaultValues(options));
            router.refresh();
            createDialog?.close();
        });
    }
    if (options.branches.length === 0) {
        return (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Assign at least one active branch before creating finance accounts." }), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { type: "button", variant: "outline", onClick: () => createDialog?.close(), children: "Close" }) })] }));
    }
    return (_jsxs("form", { className: "grid gap-6 xl:grid-cols-[2fr_1fr]", onChangeCapture: () => {
            if (submitError) {
                setSubmitError(null);
            }
        }, onSubmit: form.handleSubmit(onSubmit), children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "New bank or cash account" }) }), _jsxs(CardContent, { className: "space-y-6", children: [_jsx(FormFeedback, { errors: form.formState.errors, submitError: submitError, showValidationSummary: form.formState.submitCount > 0 }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "finance-account-branch", children: "Branch" }), _jsx(Select, { id: "finance-account-branch", ...form.register("branchId"), children: options.branches.map((branch) => (_jsxs("option", { value: branch.id, children: [branch.code, " - ", branch.name] }, branch.id))) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.branchId?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "finance-account-type", children: "Account type" }), _jsxs(Select, { id: "finance-account-type", ...form.register("type"), children: [_jsx("option", { value: "BANK", children: "Bank" }), _jsx("option", { value: "CASH", children: "Cash" })] }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.type?.message })] })] }), type === "CASH" ? (_jsxs("div", { className: "rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground", children: ["Each branch uses one shared cash account. It will be created as ", _jsx("span", { className: "font-medium text-foreground", children: "Cash" }), " for the selected branch."] })) : null, type === "CASH" && branchHasCashAccount ? (_jsx("div", { className: "rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900", children: "This branch already has its cash account. Create another bank account instead." })) : null, _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [type === "BANK" ? (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "finance-account-name", children: "Account / person name" }), _jsx(Input, { id: "finance-account-name", placeholder: "Abebe", ...form.register("name") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.name?.message })] })) : (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Cash account" }), _jsx(Input, { value: "Cash", readOnly: true })] })), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "finance-account-initial-balance", children: "Initial balance" }), _jsx(Input, { id: "finance-account-initial-balance", type: "number", min: 0, step: "0.01", ...form.register("initialBalance") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.initialBalance?.message })] })] }), type === "BANK" ? (_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "finance-account-bank-name", children: "Bank name" }), _jsx(Input, { id: "finance-account-bank-name", placeholder: "CBE", ...form.register("bankName") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.bankName?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "finance-account-number", children: "Account number" }), _jsx(Input, { id: "finance-account-number", placeholder: "10002346986787", ...form.register("accountNumber") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.accountNumber?.message })] })] })) : null] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Posting rule" }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsx("div", { className: "rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground", children: "Saving a new account can also post an opening balance so the account starts with the correct current amount." }), _jsxs("div", { className: "flex flex-col-reverse gap-2 sm:flex-row", children: [_jsx(Button, { type: "button", variant: "outline", className: "sm:flex-1", disabled: isPending, onClick: handleCancel, children: "Cancel" }), _jsx(Button, { className: "sm:flex-1", type: "submit", disabled: isPending || !canSubmit, children: isPending ? "Saving..." : "Create account" })] })] })] })] }));
}
