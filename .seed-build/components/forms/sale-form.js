"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CustomerForm } from "@/components/forms/customer-form";
import { FormFeedback } from "@/components/forms/form-feedback";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createSaleAction } from "@/lib/actions/sales";
import { formatFinanceAccountLabel } from "@/lib/finance-account-utils";
import { formatCurrency } from "@/lib/utils";
import { saleSchema } from "@/lib/validation/sale";
function getOwnedBatchesForLine(options, branchId, productId) {
    if (!branchId || !productId) {
        return [];
    }
    return options.ownedBatches.filter((batch) => batch.branchId === branchId && batch.productId === productId);
}
function getAvailableProductsForBranch(options, branchId) {
    if (!branchId) {
        return options.products;
    }
    const availableProductIds = new Set(options.branchStock
        .filter((item) => item.branchId === branchId && item.availableQty > 0)
        .map((item) => item.productId));
    return options.products.filter((product) => availableProductIds.has(product.id));
}
function getBranchProductStock(options, branchId, productId) {
    if (!branchId || !productId) {
        return null;
    }
    return (options.branchStock.find((item) => item.branchId === branchId && item.productId === productId) ?? null);
}
function getAvailableAccountsForSale(options, branchId, paymentMethod) {
    if (paymentMethod === "CREDIT") {
        return [];
    }
    return options.accounts.filter((account) => (!branchId || !account.branchId || account.branchId === branchId) &&
        account.type === paymentMethod);
}
function getDefaultValues(options, initialBranchId, initialProductId) {
    const selectedBranch = options.branches.find((branch) => branch.id === initialBranchId) ??
        options.branches[0];
    const branchProducts = getAvailableProductsForBranch(options, selectedBranch?.id);
    const defaultProduct = branchProducts.find((product) => product.id === initialProductId) ?? branchProducts[0];
    const defaultBatches = getOwnedBatchesForLine(options, selectedBranch?.id, defaultProduct?.id);
    const defaultCashAccounts = getAvailableAccountsForSale(options, selectedBranch?.id, "CASH");
    const defaultBankAccounts = getAvailableAccountsForSale(options, selectedBranch?.id, "BANK");
    const defaultPaymentMethod = defaultCashAccounts[0]
        ? "CASH"
        : defaultBankAccounts[0]
            ? "BANK"
            : "CREDIT";
    const defaultFinanceAccount = defaultPaymentMethod === "BANK" ? defaultBankAccounts[0] : defaultCashAccounts[0];
    const defaultStock = getBranchProductStock(options, selectedBranch?.id, defaultProduct?.id);
    return {
        branchId: selectedBranch?.id ?? "",
        customerId: "",
        paymentMethod: defaultPaymentMethod,
        financeAccountId: defaultFinanceAccount?.id ?? "",
        soldAt: new Date().toISOString().slice(0, 16),
        note: "",
        items: [
            {
                productId: defaultProduct?.id ?? "",
                ownedBatchId: "",
                quantity: 1,
                unitPrice: defaultBatches[0]?.sellingPrice ?? defaultStock?.defaultUnitPrice ?? 0,
                discount: 0,
            },
        ],
    };
}
export function SaleForm({ options, initialBranchId, initialProductId, mode = "page", cancelHref, onCancel, onSuccess, }) {
    const createDialog = useCreateDialog();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [submitError, setSubmitError] = useState(null);
    const [customerOptions, setCustomerOptions] = useState(options.customers);
    const [isCustomerDialogOpen, setCustomerDialogOpen] = useState(false);
    const defaultValues = getDefaultValues(options, initialBranchId, initialProductId);
    const defaultBranchProducts = getAvailableProductsForBranch(options, defaultValues.branchId);
    const defaultProduct = defaultBranchProducts.find((product) => product.id === initialProductId) ??
        defaultBranchProducts[0];
    const form = useForm({
        resolver: zodResolver(saleSchema),
        defaultValues,
    });
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    });
    const branchId = form.watch("branchId");
    const customerId = form.watch("customerId");
    const paymentMethod = form.watch("paymentMethod");
    const financeAccountId = form.watch("financeAccountId");
    const items = form.watch("items");
    const currentBranchProducts = getAvailableProductsForBranch(options, branchId);
    const availablePaymentAccounts = getAvailableAccountsForSale(options, branchId, paymentMethod);
    const canSubmit = options.branches.length > 0 && currentBranchProducts.length > 0;
    const canPostWithPaymentAccount = paymentMethod === "CREDIT" || availablePaymentAccounts.length > 0;
    const previousBranchId = useRef(defaultValues.branchId);
    const previousLineState = useRef(defaultValues.items.map((item) => ({
        productId: item.productId,
        ownedBatchId: item.ownedBatchId ?? "",
    })));
    const grossTotal = items.reduce((sum, item) => {
        return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
    }, 0);
    const discountTotal = items.reduce((sum, item) => {
        return sum + Number(item.quantity || 0) * Number(item.discount || 0);
    }, 0);
    const total = grossTotal - discountTotal;
    useEffect(() => {
        const branchChanged = branchId !== previousBranchId.current;
        items.forEach((item, index) => {
            const previousLine = previousLineState.current[index];
            const availableProducts = getAvailableProductsForBranch(options, branchId);
            const fallbackProductId = availableProducts[0]?.id ?? "";
            const productStillAvailable = availableProducts.some((product) => product.id === item.productId);
            const nextProductId = productStillAvailable ? item.productId : fallbackProductId;
            const stockEntry = getBranchProductStock(options, branchId, nextProductId);
            const availableBatches = getOwnedBatchesForLine(options, branchId, nextProductId);
            const selectedBatch = availableBatches.find((batch) => batch.id === item.ownedBatchId);
            const previousProductId = previousLine?.productId;
            const previousOwnedBatchId = previousLine?.ownedBatchId ?? "";
            const productChanged = item.productId !== previousProductId;
            const batchChanged = (item.ownedBatchId ?? "") !== previousOwnedBatchId;
            const batchStillValid = !item.ownedBatchId ||
                availableBatches.some((batch) => batch.id === item.ownedBatchId);
            if (!productStillAvailable && item.productId !== nextProductId) {
                form.setValue(`items.${index}.productId`, nextProductId, {
                    shouldDirty: true,
                });
            }
            if (!batchStillValid) {
                form.setValue(`items.${index}.ownedBatchId`, "", {
                    shouldDirty: true,
                });
            }
            if (!productChanged && !batchChanged && !branchChanged) {
                return;
            }
            form.setValue(`items.${index}.unitPrice`, selectedBatch?.sellingPrice ??
                availableBatches[0]?.sellingPrice ??
                stockEntry?.defaultUnitPrice ??
                0, {
                shouldDirty: true,
            });
            form.setValue(`items.${index}.discount`, 0, {
                shouldDirty: true,
            });
        });
        previousBranchId.current = branchId;
        previousLineState.current = items.map((item) => ({
            productId: item.productId,
            ownedBatchId: item.ownedBatchId ?? "",
        }));
    }, [branchId, form, items, options]);
    useEffect(() => {
        if (!customerId) {
            return;
        }
        if (!customerOptions.some((customer) => customer.id === customerId)) {
            form.setValue("customerId", "", {
                shouldDirty: true,
                shouldValidate: true,
            });
        }
    }, [customerId, customerOptions, form]);
    useEffect(() => {
        if (paymentMethod === "CREDIT") {
            if (financeAccountId) {
                form.setValue("financeAccountId", "", {
                    shouldDirty: true,
                    shouldValidate: true,
                });
            }
            return;
        }
        if (!availablePaymentAccounts.some((account) => account.id === financeAccountId)) {
            form.setValue("financeAccountId", availablePaymentAccounts[0]?.id ?? "", {
                shouldDirty: true,
                shouldValidate: true,
            });
        }
    }, [availablePaymentAccounts, financeAccountId, form, paymentMethod]);
    function handleCancel() {
        setSubmitError(null);
        form.reset(defaultValues);
        if (mode === "page") {
            onCancel?.();
            if (cancelHref) {
                router.push(cancelHref);
            }
            else {
                router.back();
            }
            return;
        }
        onCancel?.();
        createDialog?.close();
    }
    function onSubmit(values) {
        startTransition(async () => {
            setSubmitError(null);
            const result = await createSaleAction(values);
            if (!result.success) {
                setSubmitError(result.message);
                toast.error(result.message);
                return;
            }
            setSubmitError(null);
            toast.success(result.message);
            form.reset(defaultValues);
            router.refresh();
            onSuccess?.();
            createDialog?.close();
        });
    }
    return (_jsxs(_Fragment, { children: [_jsxs("form", { className: "grid gap-6 xl:grid-cols-[2fr_1fr]", onChangeCapture: () => {
                    if (submitError) {
                        setSubmitError(null);
                    }
                }, onSubmit: form.handleSubmit(onSubmit), children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Fast sale screen" }) }), _jsxs(CardContent, { className: "space-y-6", children: [_jsx(FormFeedback, { errors: form.formState.errors, submitError: submitError, showValidationSummary: form.formState.submitCount > 0 }), !canSubmit ? (_jsx("div", { className: "rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900", children: options.branchStock.length === 0
                                            ? "No sellable stock is available in your assigned branches yet."
                                            : "No sellable stock is available in the selected branch." })) : null, _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "sale-branch", children: "Branch" }), _jsx(Select, { id: "sale-branch", ...form.register("branchId"), children: options.branches.map((branch) => (_jsxs("option", { value: branch.id, children: [branch.code, " - ", branch.name] }, branch.id))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx(Label, { htmlFor: "customerId", children: "Customer" }), _jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: "h-8 px-2 text-primary", onClick: () => setCustomerDialogOpen(true), children: [_jsx(Plus, { className: "h-4 w-4" }), "Add customer"] })] }), _jsxs(Select, { id: "customerId", ...form.register("customerId"), children: [_jsx("option", { value: "", children: "Walk-in Customer" }), customerOptions.map((customer) => (_jsx("option", { value: customer.id, children: customer.name }, customer.id)))] }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Leave this as walk-in for cash or bank sales when no customer record is needed. Credit sales require a customer." }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.customerId?.message })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "paymentMethod", children: "Payment method" }), _jsxs(Select, { id: "paymentMethod", ...form.register("paymentMethod"), children: [_jsx("option", { value: "CASH", children: "Cash" }), _jsx("option", { value: "BANK", children: "Bank" }), _jsx("option", { value: "CREDIT", children: "Credit" })] }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.paymentMethod?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "soldAt", children: "Sale date" }), _jsx(Input, { id: "soldAt", type: "datetime-local", ...form.register("soldAt") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.soldAt?.message })] })] }), paymentMethod !== "CREDIT" ? (_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "financeAccountId", children: paymentMethod === "BANK" ? "Bank account" : "Cash account" }), _jsxs(Select, { id: "financeAccountId", ...form.register("financeAccountId"), children: [_jsx("option", { value: "", children: paymentMethod === "BANK"
                                                                    ? "Select bank account"
                                                                    : "Select cash account" }), availablePaymentAccounts.map((account) => (_jsx("option", { value: account.id, children: formatFinanceAccountLabel(account) }, account.id)))] }), _jsx("p", { className: "text-xs text-muted-foreground", children: paymentMethod === "BANK"
                                                            ? "Bank sales post into the selected bank account."
                                                            : "Cash sales post into the single branch cash account." }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.financeAccountId?.message })] }), availablePaymentAccounts.length === 0 ? (_jsxs("div", { className: "rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900", children: ["No active ", paymentMethod === "BANK" ? "bank" : "cash", " account is available for this branch yet."] })) : (_jsx("div", { className: "rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground", children: "The selected account will receive the full paid amount for this sale." }))] })) : (_jsx("div", { className: "rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground", children: "Credit sales do not hit cash or bank until you record a payment later." })), _jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "flex items-center justify-between", children: _jsx("h3", { className: "text-sm font-semibold uppercase tracking-wide text-muted-foreground", children: "Sale lines" }) }), _jsx("div", { className: "space-y-4", children: fields.map((field, index) => (_jsxs("div", { className: "rounded-2xl border border-primary/15 bg-primary/[0.035] p-4 dark:border-primary/20 dark:bg-primary/[0.08]", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between gap-3", children: [_jsxs("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/85", children: ["Sale line ", index + 1] }), index > 0 ? (_jsx(Button, { type: "button", variant: "outline", size: "icon", className: "h-9 w-9 shrink-0 rounded-lg border-destructive/35 bg-background/80 text-destructive shadow-sm hover:bg-destructive/10 hover:text-destructive", onClick: () => remove(index), children: _jsx(Trash2, { className: "h-4 w-4" }) })) : null] }), _jsx("div", { className: "grid gap-4 lg:grid-cols-[2fr_1.6fr_1fr_1fr_1fr]", children: (() => {
                                                                const branchProducts = getAvailableProductsForBranch(options, branchId);
                                                                const stockEntry = getBranchProductStock(options, branchId, items[index]?.productId);
                                                                const lineBatches = getOwnedBatchesForLine(options, branchId, items[index]?.productId);
                                                                const selectedBatch = lineBatches.find((batch) => batch.id === items[index]?.ownedBatchId);
                                                                const maxQuantity = selectedBatch?.remainingQuantity ?? stockEntry?.availableQty ?? 0;
                                                                const currentQuantity = Number(items[index]?.quantity ?? 1);
                                                                return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Item name" }), _jsxs(Select, { ...form.register(`items.${index}.productId`), children: [branchProducts.length === 0 ? (_jsx("option", { value: "", children: "No stock available in this branch" })) : null, branchProducts.map((product) => (_jsx("option", { value: product.id, children: product.name }, product.id)))] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Batch" }), _jsxs(Select, { ...form.register(`items.${index}.ownedBatchId`), children: [_jsx("option", { value: "", children: "Auto select (FIFO)" }), lineBatches.map((batch) => (_jsxs("option", { value: batch.id, children: [batch.referenceNumber, " | ", batch.sourceName, " | ", batch.remainingQuantity, " left | ", formatCurrency(batch.sellingPrice)] }, batch.id)))] }), _jsx("p", { className: "text-xs text-muted-foreground", children: lineBatches.length > 0
                                                                                        ? "Select an owned batch to sell from a specific lot, or leave auto for FIFO."
                                                                                        : stockEntry
                                                                                            ? "This item has no remaining owned batch to choose here. The sale will allocate automatically from the available stock source."
                                                                                            : "Select an in-stock item first." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Qty" }), _jsxs("div", { className: "flex items-center rounded-xl border border-border bg-background", children: [_jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-10 w-10 rounded-none rounded-l-xl", disabled: currentQuantity <= 1, onClick: () => form.setValue(`items.${index}.quantity`, Math.max(1, currentQuantity - 1), { shouldDirty: true }), children: _jsx(Minus, { className: "h-4 w-4" }) }), _jsx(Input, { type: "number", min: 1, max: maxQuantity || undefined, className: "border-0 text-center shadow-none focus-visible:ring-0", ...form.register(`items.${index}.quantity`) }), _jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-10 w-10 rounded-none rounded-r-xl", disabled: maxQuantity > 0 ? currentQuantity >= maxQuantity : false, onClick: () => form.setValue(`items.${index}.quantity`, currentQuantity + 1, {
                                                                                                shouldDirty: true,
                                                                                            }), children: _jsx(Plus, { className: "h-4 w-4" }) })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: maxQuantity > 0
                                                                                        ? `Available to sell: ${maxQuantity}`
                                                                                        : "No quantity is available for this item in the selected branch." }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items?.[index]?.quantity?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Unit Price" }), _jsx(Input, { type: "number", min: 0, step: "0.01", ...form.register(`items.${index}.unitPrice`) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Defaults from the selected batch or the earliest available stock. You can still override it for this sale." }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items?.[index]?.unitPrice?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Discount / Unit" }), _jsx(Input, { type: "number", min: 0, step: "0.01", ...form.register(`items.${index}.discount`) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Applied per unit before the line total is calculated." }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items?.[index]?.discount?.message })] })] }));
                                                            })() })] }, field.id))) }), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "button", variant: "outline", size: "sm", disabled: getAvailableProductsForBranch(options, branchId).length === 0, onClick: () => {
                                                        const branchProducts = getAvailableProductsForBranch(options, branchId);
                                                        const nextProduct = branchProducts[0];
                                                        const nextStock = getBranchProductStock(options, branchId, nextProduct?.id);
                                                        append({
                                                            productId: nextProduct?.id ?? "",
                                                            ownedBatchId: "",
                                                            quantity: 1,
                                                            unitPrice: getOwnedBatchesForLine(options, branchId, nextProduct?.id)[0]
                                                                ?.sellingPrice ??
                                                                nextStock?.defaultUnitPrice ??
                                                                0,
                                                            discount: 0,
                                                        });
                                                    }, children: [_jsx(Plus, { className: "h-4 w-4" }), "Add item"] }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "sale-note", children: "Note" }), _jsx(Textarea, { id: "sale-note", rows: 3, ...form.register("note") })] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Receipt summary" }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "rounded-2xl bg-muted/60 p-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Gross total" }), _jsx("p", { className: "mt-2 text-xl font-semibold", children: formatCurrency(grossTotal) })] }), _jsxs("div", { className: "rounded-2xl bg-muted/60 p-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Discount total" }), _jsx("p", { className: "mt-2 text-xl font-semibold", children: formatCurrency(discountTotal) })] }), _jsxs("div", { className: "rounded-2xl bg-muted/60 p-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Calculated total" }), _jsx("p", { className: "mt-2 text-3xl font-semibold", children: formatCurrency(total) })] }), _jsxs("div", { className: "flex flex-col-reverse gap-2 sm:flex-row", children: [_jsx(Button, { type: "button", variant: "outline", className: "sm:flex-1", disabled: isPending, onClick: handleCancel, children: "Cancel" }), _jsx(Button, { className: "sm:flex-1", type: "submit", disabled: isPending || !canSubmit || !canPostWithPaymentAccount, children: isPending ? "Saving..." : "Save sale" })] })] })] })] }), _jsx(Dialog, { open: isCustomerDialogOpen, onOpenChange: setCustomerDialogOpen, children: _jsxs(DialogContent, { className: "max-w-xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Add customer" }), _jsx(DialogDescription, { children: "Create a customer without leaving the sale screen. You can still leave the sale as walk-in." })] }), _jsx(CustomerForm, { submitLabel: "Save customer", refreshAfterSuccess: false, onCancel: () => setCustomerDialogOpen(false), onSuccess: (customer) => {
                                setCustomerOptions((current) => [...current, customer].sort((left, right) => left.name.localeCompare(right.name)));
                                form.setValue("customerId", customer.id, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                });
                                setCustomerDialogOpen(false);
                            } })] }) })] }));
}
