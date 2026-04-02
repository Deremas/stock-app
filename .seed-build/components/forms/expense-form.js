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
import { createExpenseAction } from "@/lib/actions/expenses";
import { formatFinanceAccountLabel } from "@/lib/finance-account-utils";
import { expenseSchema, } from "@/lib/validation/expense";
function getDefaultValues(options) {
    return {
        branchId: options.branches[0]?.id ?? "",
        financeAccountId: "",
        categoryName: options.categoryNames[0] ?? "",
        name: "",
        amount: 0,
        expenseDate: new Date().toISOString().slice(0, 16),
        note: "",
    };
}
export function ExpenseForm({ options }) {
    const createDialog = useCreateDialog();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [submitError, setSubmitError] = useState(null);
    const defaultValues = getDefaultValues(options);
    const form = useForm({
        resolver: zodResolver(expenseSchema),
        defaultValues,
    });
    const branchId = form.watch("branchId");
    const availableAccounts = useMemo(() => options.accounts.filter((account) => account.branchId === branchId), [branchId, options.accounts]);
    useEffect(() => {
        const financeAccountId = form.getValues("financeAccountId");
        if (!availableAccounts.some((account) => account.id === financeAccountId)) {
            form.setValue("financeAccountId", availableAccounts[0]?.id ?? "", {
                shouldDirty: true,
            });
        }
    }, [availableAccounts, form]);
    function handleCancel() {
        setSubmitError(null);
        form.reset(defaultValues);
        createDialog?.close();
    }
    function onSubmit(values) {
        startTransition(async () => {
            setSubmitError(null);
            const result = await createExpenseAction(values);
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
    if (options.branches.length === 0 || options.accounts.length === 0) {
        return (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Create a branch payment account before recording expenses." }), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { type: "button", variant: "outline", onClick: () => createDialog?.close(), children: "Close" }) })] }));
    }
    return (_jsxs("form", { className: "grid gap-6 xl:grid-cols-[2fr_1fr]", onChangeCapture: () => {
            if (submitError) {
                setSubmitError(null);
            }
        }, onSubmit: form.handleSubmit(onSubmit), children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "New expense" }) }), _jsxs(CardContent, { className: "space-y-6", children: [_jsx(FormFeedback, { errors: form.formState.errors, submitError: submitError, showValidationSummary: form.formState.submitCount > 0 }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "expense-branch", children: "Branch" }), _jsx(Select, { id: "expense-branch", ...form.register("branchId"), children: options.branches.map((branch) => (_jsxs("option", { value: branch.id, children: [branch.code, " - ", branch.name] }, branch.id))) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.branchId?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "expense-date", children: "Expense date" }), _jsx(Input, { id: "expense-date", type: "datetime-local", ...form.register("expenseDate") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.expenseDate?.message })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "expense-account", children: "Payment account" }), _jsx(Select, { id: "expense-account", ...form.register("financeAccountId"), children: availableAccounts.map((account) => (_jsx("option", { value: account.id, children: formatFinanceAccountLabel(account) }, account.id))) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.financeAccountId?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "expense-amount", children: "Amount" }), _jsx(Input, { id: "expense-amount", type: "number", min: 0.01, step: "0.01", ...form.register("amount") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.amount?.message })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "expense-category", children: "Category" }), _jsx(Input, { id: "expense-category", list: "expense-category-list", placeholder: "Transport, Rent, Utilities...", ...form.register("categoryName") }), _jsx("datalist", { id: "expense-category-list", children: options.categoryNames.map((name) => (_jsx("option", { value: name }, name))) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.categoryName?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "expense-name", children: "Expense name" }), _jsx(Input, { id: "expense-name", placeholder: "Fuel, loading, lunch...", ...form.register("name") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.name?.message })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "expense-note", children: "Note" }), _jsx(Textarea, { id: "expense-note", rows: 3, ...form.register("note") })] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Category tracking" }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsx("div", { className: "rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground", children: "You can pick an existing category or type a new one. New category names are created automatically when the expense is saved." }), _jsxs("div", { className: "flex flex-col-reverse gap-2 sm:flex-row", children: [_jsx(Button, { type: "button", variant: "outline", className: "sm:flex-1", disabled: isPending, onClick: handleCancel, children: "Cancel" }), _jsx(Button, { className: "sm:flex-1", type: "submit", disabled: isPending, children: isPending ? "Saving..." : "Post expense" })] })] })] })] }));
}
