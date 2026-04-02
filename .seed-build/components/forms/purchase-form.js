"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormFeedback } from "@/components/forms/form-feedback";
import { SupplierForm } from "@/components/forms/supplier-form";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createPurchaseAction } from "@/lib/actions/purchases";
import { cn, formatCurrency } from "@/lib/utils";
import { purchaseSchema, } from "@/lib/validation/purchase";
import { formatFinanceAccountLabel } from "@/lib/finance-account-utils";
function PurchaseItemPicker({ value, products, disabledProductIds, onValueChange, }) {
    const selectedProduct = products.find((product) => product.id === value);
    return (_jsxs(DropdownMenu, { modal: false, children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs("button", { type: "button", className: "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-primary/40 data-[state=open]:ring-2 data-[state=open]:ring-primary/20", children: [_jsx("span", { className: cn("min-w-0 truncate text-left", selectedProduct ? "text-foreground" : "text-muted-foreground"), children: selectedProduct?.name ?? "Select item" }), _jsx(ChevronDown, { className: "h-4 w-4 shrink-0 text-muted-foreground" })] }) }), _jsx(DropdownMenuContent, { align: "start", collisionPadding: 12, className: "w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)] max-w-[min(24rem,calc(100vw-2rem))] p-1", children: _jsxs(DropdownMenuRadioGroup, { value: value, onValueChange: onValueChange, children: [_jsx(DropdownMenuRadioItem, { value: "", children: _jsx("span", { className: "truncate", children: "Select item" }) }), products.map((product) => {
                            const disabled = disabledProductIds.has(product.id) && product.id !== value;
                            return (_jsx(DropdownMenuRadioItem, { value: product.id, disabled: disabled, className: "max-w-full", children: _jsxs("div", { className: "flex min-w-0 items-center justify-between gap-3", children: [_jsx("span", { className: "truncate", children: product.name }), disabled ? (_jsx("span", { className: "shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground", children: "Added" })) : null] }) }, product.id));
                        })] }) })] }));
}
function getDefaultValues(options, initialBranchId, initialProductId) {
    const defaultProduct = options.products.find((product) => product.id === initialProductId);
    const defaultBranch = options.branches.find((branch) => branch.id === initialBranchId) ??
        options.branches[0];
    return {
        branchId: defaultBranch?.id ?? "",
        supplierId: "",
        paymentAccountId: "",
        settlementMode: "UNPAID",
        amountPaid: 0,
        purchasedAt: new Date().toISOString().slice(0, 16),
        note: "",
        items: [
            {
                productId: defaultProduct?.id ?? "",
                quantity: 1,
                unitCost: 0,
                sellingPrice: 0,
            },
        ],
    };
}
export function PurchaseForm({ options, initialBranchId, initialProductId, mode = "page", cancelHref, onCancel, onSuccess, }) {
    const createDialog = useCreateDialog();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [submitError, setSubmitError] = useState(null);
    const [supplierOptions, setSupplierOptions] = useState(options.suppliers);
    const [isSupplierDialogOpen, setSupplierDialogOpen] = useState(false);
    const defaultValues = getDefaultValues({ ...options, suppliers: supplierOptions }, initialBranchId, initialProductId);
    const canSubmit = options.branches.length > 0 &&
        options.products.length > 0;
    const form = useForm({
        resolver: zodResolver(purchaseSchema),
        defaultValues,
    });
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    });
    const branchId = form.watch("branchId");
    const supplierId = form.watch("supplierId");
    const settlementMode = form.watch("settlementMode");
    const paymentAccountId = form.watch("paymentAccountId");
    const rawAmountPaid = Number(form.watch("amountPaid") || 0);
    const items = form.watch("items");
    const previousProductIds = useRef(defaultValues.items.map((item) => item.productId));
    const total = items.reduce((sum, item) => {
        return sum + Number(item.quantity || 0) * Number(item.unitCost || 0);
    }, 0);
    const availableAccounts = useMemo(() => options.accounts.filter((account) => !branchId || !account.branchId || account.branchId === branchId), [branchId, options.accounts]);
    const selectedProductIds = useMemo(() => new Set(items.map((item) => item.productId).filter(Boolean)), [items]);
    const hasUnusedProducts = useMemo(() => options.products.some((product) => !selectedProductIds.has(product.id)), [options.products, selectedProductIds]);
    const effectiveAmountPaid = settlementMode === "UNPAID"
        ? 0
        : settlementMode === "FULL"
            ? total
            : Math.min(rawAmountPaid, total);
    const amountDue = Math.max(total - effectiveAmountPaid, 0);
    const canPostWithPayment = settlementMode === "UNPAID" || availableAccounts.length > 0;
    useEffect(() => {
        items.forEach((item, index) => {
            const previousProductId = previousProductIds.current[index];
            if (item.productId === previousProductId) {
                return;
            }
            form.setValue(`items.${index}.unitCost`, 0, {
                shouldDirty: true,
            });
            form.setValue(`items.${index}.sellingPrice`, 0, {
                shouldDirty: true,
            });
        });
        previousProductIds.current = items.map((item) => item.productId);
    }, [form, items, options.products]);
    useEffect(() => {
        if (supplierOptions.length === 0) {
            if (supplierId) {
                form.setValue("supplierId", "", {
                    shouldDirty: true,
                    shouldValidate: true,
                });
            }
            return;
        }
        if (supplierId && !supplierOptions.some((supplier) => supplier.id === supplierId)) {
            form.setValue("supplierId", "", {
                shouldDirty: true,
                shouldValidate: true,
            });
        }
    }, [form, supplierId, supplierOptions]);
    useEffect(() => {
        if (settlementMode !== "UNPAID" &&
            availableAccounts.length > 0 &&
            !availableAccounts.some((account) => account.id === paymentAccountId)) {
            form.setValue("paymentAccountId", availableAccounts[0]?.id ?? "", {
                shouldDirty: true,
                shouldValidate: true,
            });
        }
        if (settlementMode !== "UNPAID" && availableAccounts.length === 0 && paymentAccountId) {
            form.setValue("paymentAccountId", "", {
                shouldDirty: true,
                shouldValidate: true,
            });
        }
        if (settlementMode === "UNPAID" && paymentAccountId) {
            form.setValue("paymentAccountId", "", {
                shouldDirty: true,
                shouldValidate: true,
            });
        }
    }, [availableAccounts, form, paymentAccountId, settlementMode]);
    useEffect(() => {
        if (settlementMode === "UNPAID") {
            if (rawAmountPaid !== 0) {
                form.setValue("amountPaid", 0, {
                    shouldDirty: true,
                    shouldValidate: true,
                });
            }
            return;
        }
        if (settlementMode === "FULL" && rawAmountPaid !== total) {
            form.setValue("amountPaid", total, {
                shouldDirty: true,
                shouldValidate: true,
            });
            return;
        }
        if (settlementMode === "PARTIAL") {
            const suggestedPartial = total <= 0
                ? 0
                : Number(Math.max(0.01, Math.min(total - 0.01, total / 2)).toFixed(2));
            if (rawAmountPaid <= 0 || rawAmountPaid >= total) {
                form.setValue("amountPaid", suggestedPartial, {
                    shouldDirty: true,
                    shouldValidate: true,
                });
            }
        }
    }, [form, rawAmountPaid, settlementMode, total]);
    function getResetValues() {
        return {
            ...getDefaultValues({ ...options, suppliers: supplierOptions }, form.getValues("branchId") || initialBranchId, initialProductId),
            branchId: form.getValues("branchId") || defaultValues.branchId,
            supplierId: form.getValues("supplierId") || "",
        };
    }
    function handleCancel() {
        setSubmitError(null);
        form.reset(getResetValues());
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
            const result = await createPurchaseAction(values);
            if (!result.success) {
                setSubmitError(result.message);
                toast.error(result.message);
                return;
            }
            setSubmitError(null);
            toast.success(result.message);
            form.reset(getResetValues());
            router.refresh();
            onSuccess?.();
            createDialog?.close();
        });
    }
    function handleAppendItem() {
        if (!hasUnusedProducts) {
            toast.error("All items are already added. Increase quantity on the existing line instead.");
            return;
        }
        append({
            productId: "",
            quantity: 1,
            unitCost: 0,
            sellingPrice: 0,
        });
    }
    return (_jsxs(_Fragment, { children: [_jsxs("form", { className: "grid gap-3 sm:gap-6 xl:grid-cols-[2fr_1fr]", onChangeCapture: () => {
                    if (submitError) {
                        setSubmitError(null);
                    }
                }, onSubmit: form.handleSubmit(onSubmit), children: [_jsxs(Card, { children: [_jsx(CardHeader, { className: "p-4 sm:p-6", children: _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsx(CardTitle, { children: "Purchase entry" }), !canSubmit ? (_jsx("p", { className: "text-[11px] font-medium text-muted-foreground sm:text-xs", children: "Need branch and item." })) : null] }) }), _jsxs(CardContent, { className: "space-y-4 p-4 pt-0 sm:space-y-6 sm:p-6 sm:pt-0", children: [_jsx(FormFeedback, { errors: form.formState.errors, submitError: submitError, showValidationSummary: form.formState.submitCount > 0 }), _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "branchId", children: "Branch" }), _jsx(Select, { id: "branchId", ...form.register("branchId"), children: options.branches.map((branch) => (_jsxs("option", { value: branch.id, children: [branch.code, " - ", branch.name] }, branch.id))) }), form.formState.errors.branchId?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.branchId.message })) : null] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx(Label, { htmlFor: "supplierId", children: "Supplier (optional)" }), _jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: "h-8 px-2 text-primary", onClick: () => setSupplierDialogOpen(true), children: [_jsx(Plus, { className: "h-4 w-4" }), "Add supplier"] })] }), _jsxs(Select, { id: "supplierId", ...form.register("supplierId"), children: [_jsx("option", { value: "", children: "Select supplier" }), supplierOptions.map((supplier) => (_jsx("option", { value: supplier.id, children: supplier.name }, supplier.id)))] }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Leave blank for a direct purchase paid now. Choose a supplier if this purchase needs payable tracking or later settlement." }), form.formState.errors.supplierId?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.supplierId.message })) : null] })] }), _jsx("div", { className: "grid gap-3", children: _jsxs("div", { className: "w-full max-w-[18rem] space-y-2 sm:max-w-[19rem]", children: [_jsx(Label, { htmlFor: "purchasedAt", children: "Purchase date" }), _jsx(Input, { id: "purchasedAt", type: "datetime-local", ...form.register("purchasedAt") }), form.formState.errors.purchasedAt?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.purchasedAt.message })) : null] }) }), _jsxs("div", { className: "space-y-3 sm:space-y-4", children: [_jsx("div", { className: "flex flex-wrap items-center justify-between gap-2", children: _jsx("h3", { className: "text-sm font-semibold uppercase tracking-wide text-muted-foreground", children: "Line items" }) }), _jsx("div", { className: "space-y-2.5 sm:space-y-4", children: fields.map((field, index) => (_jsxs("div", { className: "rounded-2xl border border-primary/15 bg-primary/[0.035] p-3 dark:border-primary/20 dark:bg-primary/[0.08] sm:p-4", children: [_jsx("div", { className: "mb-3 flex items-center justify-between gap-3", children: _jsxs("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/85", children: ["Line ", index + 1] }) }), _jsxs("div", { className: "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,3.7fr)_minmax(88px,0.6fr)_minmax(124px,0.9fr)_minmax(136px,0.95fr)] lg:items-end", children: [_jsxs("div", { className: "col-span-2 space-y-2 lg:col-span-1", children: [_jsx(Label, { className: "text-xs font-medium sm:text-sm", children: "Item name" }), _jsx(PurchaseItemPicker, { value: items[index]?.productId ?? "", products: options.products, disabledProductIds: new Set(items
                                                                                .filter((_, itemIndex) => itemIndex !== index)
                                                                                .map((item) => item.productId)
                                                                                .filter(Boolean)), onValueChange: (nextValue) => form.setValue(`items.${index}.productId`, nextValue, {
                                                                                shouldDirty: true,
                                                                                shouldValidate: true,
                                                                            }) }), items.some((item, itemIndex) => itemIndex !== index &&
                                                                            item.productId &&
                                                                            item.productId === items[index]?.productId) ? (_jsx("p", { className: "text-xs text-muted-foreground", children: "This item is already added. Increase its quantity on the existing line instead." })) : null, form.formState.errors.items?.[index]?.productId?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items[index]?.productId?.message })) : null] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-xs font-medium sm:text-sm", children: "Qty" }), _jsx(Input, { type: "number", min: 1, ...form.register(`items.${index}.quantity`) }), form.formState.errors.items?.[index]?.quantity?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items[index]?.quantity?.message })) : null] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-xs font-medium sm:text-sm", children: "Buying Price" }), _jsx(Input, { type: "number", min: 0, step: "0.01", ...form.register(`items.${index}.unitCost`) }), form.formState.errors.items?.[index]?.unitCost?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items[index]?.unitCost?.message })) : null] }), _jsxs("div", { className: "col-span-2 space-y-2 lg:col-span-1", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx(Label, { className: "text-xs font-medium sm:text-sm", children: "Selling Price" }), index > 0 ? (_jsx(Button, { type: "button", variant: "outline", size: "icon", className: "h-8 w-8 shrink-0 rounded-lg border-destructive/35 bg-background/80 text-destructive shadow-sm hover:bg-destructive/10 hover:text-destructive", onClick: () => remove(index), children: _jsx(Trash2, { className: "h-4 w-4" }) })) : null] }), _jsx(Input, { type: "number", min: 0, step: "0.01", ...form.register(`items.${index}.sellingPrice`) }), form.formState.errors.items?.[index]?.sellingPrice?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items[index]?.sellingPrice?.message })) : null] })] })] }, field.id))) }), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "button", variant: "outline", size: "sm", disabled: options.products.length === 0, onClick: handleAppendItem, children: [_jsx(Plus, { className: "h-4 w-4" }), "Add item"] }) })] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Purchase summary" }) }), _jsxs(CardContent, { className: "space-y-3 p-4 pt-0 sm:space-y-4 sm:p-6 sm:pt-0", children: [_jsxs("div", { className: "rounded-2xl bg-muted/60 p-3 sm:p-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Calculated total" }), _jsx("p", { className: "mt-2 text-3xl font-semibold", children: formatCurrency(total) })] }), _jsxs("div", { className: "space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-3 sm:space-y-4 sm:p-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "purchase-settlement-mode", children: "Payment option" }), _jsxs(Select, { id: "purchase-settlement-mode", ...form.register("settlementMode"), children: [_jsx("option", { value: "UNPAID", children: "Pay later" }), _jsx("option", { value: "FULL", children: "Pay full now" }), _jsx("option", { value: "PARTIAL", children: "Pay part now" })] })] }), settlementMode !== "UNPAID" ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "purchase-payment-account", children: "Payment account" }), _jsxs(Select, { id: "purchase-payment-account", ...form.register("paymentAccountId"), children: [_jsx("option", { value: "", children: "Select payment account" }), availableAccounts.map((account) => (_jsx("option", { value: account.id, children: formatFinanceAccountLabel(account) }, account.id)))] }), form.formState.errors.paymentAccountId?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.paymentAccountId.message })) : null] }), settlementMode === "PARTIAL" ? (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "purchase-amount-paid", children: "Amount paid now" }), _jsx(Input, { id: "purchase-amount-paid", type: "number", min: 0.01, max: total || undefined, step: "0.01", ...form.register("amountPaid") }), form.formState.errors.amountPaid?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.amountPaid.message })) : null] })) : null, availableAccounts.length === 0 ? (_jsx("div", { className: "rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900", children: "No active cash or bank account is available for this branch yet. Create one in Finance before paying during purchase creation." })) : null] })) : null] }), _jsxs("div", { className: "rounded-2xl bg-muted/60 p-4 text-sm", children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("span", { className: "text-muted-foreground", children: "Paid now" }), _jsx("span", { className: "font-semibold", children: formatCurrency(effectiveAmountPaid) })] }), _jsxs("div", { className: "mt-2 flex items-center justify-between gap-4", children: [_jsx("span", { className: "text-muted-foreground", children: "Balance due" }), _jsx("span", { className: "font-semibold", children: formatCurrency(amountDue) })] })] }), _jsxs("div", { className: "flex flex-col-reverse gap-2 sm:flex-row", children: [_jsx(Button, { type: "button", variant: "outline", className: "sm:flex-1", disabled: isPending, onClick: handleCancel, children: "Cancel" }), _jsx(Button, { className: "sm:flex-1", type: "submit", disabled: isPending || !canSubmit || !canPostWithPayment, children: isPending ? "Saving..." : "Save purchase" })] })] })] })] }), _jsx(Dialog, { open: isSupplierDialogOpen, onOpenChange: setSupplierDialogOpen, children: _jsxs(DialogContent, { className: "max-w-xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Add supplier" }), _jsx(DialogDescription, { children: "Create a supplier without leaving the purchase entry." })] }), _jsx(SupplierForm, { submitLabel: "Save supplier", refreshAfterSuccess: false, onCancel: () => setSupplierDialogOpen(false), onSuccess: (supplier) => {
                                setSupplierOptions((current) => [...current, supplier].sort((left, right) => left.name.localeCompare(right.name)));
                                form.setValue("supplierId", supplier.id, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                });
                                setSupplierDialogOpen(false);
                            } })] }) })] }));
}
