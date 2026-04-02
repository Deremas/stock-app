"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormFeedback } from "@/components/forms/form-feedback";
import { PartnerForm } from "@/components/forms/partner-form";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createSellerIntakeAction } from "@/lib/actions/sellers";
import { formatCurrency } from "@/lib/utils";
import { sellerIntakeSchema, } from "@/lib/validation/seller";
function getDefaultValues(options, initialSellerId) {
    const defaultSeller = options.sellers.find((seller) => seller.id === initialSellerId) ?? options.sellers[0];
    return {
        branchId: options.branches[0]?.id ?? "",
        sellerId: defaultSeller?.id ?? "",
        bringingDate: new Date().toISOString().slice(0, 16),
        note: "",
        items: [
            {
                itemName: "",
                quantityBrought: 1,
                sellerFixedPrice: 0,
            },
        ],
    };
}
export function SellerIntakeForm({ options, mode = "page", cancelHref, onCancel, onSuccess, initialSellerId, }) {
    const createDialog = useCreateDialog();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [submitError, setSubmitError] = useState(null);
    const [sellerOptions, setSellerOptions] = useState(options.sellers);
    const [isPartnerDialogOpen, setPartnerDialogOpen] = useState(false);
    const defaultValues = getDefaultValues({ ...options, sellers: sellerOptions }, initialSellerId);
    const hasBranches = options.branches.length > 0;
    const hasSellers = sellerOptions.length > 0;
    const canSubmit = hasBranches && hasSellers;
    const form = useForm({
        resolver: zodResolver(sellerIntakeSchema),
        defaultValues,
    });
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    });
    const sellerId = form.watch("sellerId");
    const items = form.watch("items");
    const totalReceivedQuantity = items.reduce((sum, item) => sum + Number(item.quantityBrought || 0), 0);
    const payable = items.reduce((sum, item) => {
        return sum + Number(item.quantityBrought || 0) * Number(item.sellerFixedPrice || 0);
    }, 0);
    useEffect(() => {
        if (sellerOptions.length === 0) {
            if (sellerId) {
                form.setValue("sellerId", "", {
                    shouldDirty: true,
                    shouldValidate: true,
                });
            }
            return;
        }
        if (!sellerOptions.some((seller) => seller.id === sellerId)) {
            form.setValue("sellerId", sellerOptions[0]?.id ?? "", {
                shouldDirty: true,
                shouldValidate: true,
            });
        }
    }, [form, sellerId, sellerOptions]);
    function getResetValues() {
        return {
            ...getDefaultValues({ ...options, sellers: sellerOptions }, initialSellerId),
            branchId: form.getValues("branchId") || defaultValues.branchId,
            sellerId: form.getValues("sellerId") ||
                sellerOptions.find((seller) => seller.id === initialSellerId)?.id ||
                sellerOptions[0]?.id ||
                "",
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
            const result = await createSellerIntakeAction(values);
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
        append({
            itemName: "",
            quantityBrought: 1,
            sellerFixedPrice: 0,
        });
    }
    return (_jsxs(_Fragment, { children: [_jsxs("form", { className: "grid gap-3 sm:gap-6 xl:grid-cols-[2fr_1fr]", onChangeCapture: () => {
                    if (submitError) {
                        setSubmitError(null);
                    }
                }, onSubmit: form.handleSubmit(onSubmit), children: [_jsxs(Card, { children: [_jsx(CardHeader, { className: "p-4 sm:p-6", children: _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsx(CardTitle, { children: "Received from partner" }), !canSubmit ? (_jsx("p", { className: "text-[11px] font-medium text-muted-foreground sm:text-xs", children: "Need branch and partner." })) : null] }) }), _jsxs(CardContent, { className: "space-y-4 p-4 pt-0 sm:space-y-6 sm:p-6 sm:pt-0", children: [_jsx(FormFeedback, { errors: form.formState.errors, submitError: submitError, showValidationSummary: form.formState.submitCount > 0 }), !hasBranches ? (_jsx("div", { className: "rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4", children: "Create active branches and partners before recording received items." })) : !hasSellers ? (_jsx("div", { className: "rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4", children: "Create an active partner before recording received items." })) : null, _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "intake-branch", children: "Branch" }), _jsx(Select, { id: "intake-branch", ...form.register("branchId"), children: options.branches.map((branch) => (_jsxs("option", { value: branch.id, children: [branch.code, " - ", branch.name] }, branch.id))) }), form.formState.errors.branchId?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.branchId.message })) : null] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx(Label, { htmlFor: "sellerId", children: "Partner" }), _jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: "h-8 px-2 text-primary", onClick: () => setPartnerDialogOpen(true), children: [_jsx(Plus, { className: "h-4 w-4" }), "Add partner"] })] }), _jsxs(Select, { id: "sellerId", ...form.register("sellerId"), children: [_jsx("option", { value: "", children: "Select partner" }), sellerOptions.map((seller) => (_jsx("option", { value: seller.id, children: seller.name }, seller.id)))] }), form.formState.errors.sellerId?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.sellerId.message })) : null] })] }), _jsx("div", { className: "grid gap-3", children: _jsxs("div", { className: "w-full max-w-[18rem] space-y-2 sm:max-w-[19rem]", children: [_jsx(Label, { htmlFor: "bringingDate", children: "Bringing date" }), _jsx(Input, { id: "bringingDate", type: "datetime-local", ...form.register("bringingDate") }), form.formState.errors.bringingDate?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.bringingDate.message })) : null] }) }), _jsxs("div", { className: "space-y-3 sm:space-y-4", children: [_jsx("div", { className: "flex flex-wrap items-center justify-between gap-2", children: _jsx("h3", { className: "text-sm font-semibold uppercase tracking-wide text-muted-foreground", children: "Received items" }) }), _jsx("div", { className: "space-y-2.5 sm:space-y-4", children: fields.map((field, index) => (_jsxs("div", { className: "rounded-2xl border border-primary/15 bg-primary/[0.035] p-3 dark:border-primary/20 dark:bg-primary/[0.08] sm:p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between gap-3", children: [_jsxs("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/85", children: ["Line ", index + 1] }), fields.length > 1 && index > 0 ? (_jsx(Button, { type: "button", variant: "outline", size: "icon", "aria-label": `Remove line ${index + 1}`, className: "h-8 w-8 shrink-0 rounded-lg border-destructive/35 bg-background/80 text-destructive shadow-sm hover:bg-destructive/10 hover:text-destructive", onClick: () => remove(index), children: _jsx(Trash2, { className: "h-4 w-4" }) })) : null] }), _jsxs("div", { className: "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(96px,0.8fr)_minmax(132px,1fr)]", children: [_jsxs("div", { className: "col-span-2 space-y-2 lg:col-span-1", children: [_jsx(Label, { className: "text-xs font-medium sm:text-sm", children: "Item name" }), _jsx(Input, { placeholder: "Type item name", ...form.register(`items.${index}.itemName`) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items?.[index]?.itemName?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-xs font-medium sm:text-sm", children: "Qty" }), _jsx(Input, { type: "number", min: 1, ...form.register(`items.${index}.quantityBrought`) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items?.[index]?.quantityBrought?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-xs font-medium sm:text-sm", children: "Price got" }), _jsx(Input, { type: "number", min: 0, step: "0.01", ...form.register(`items.${index}.sellerFixedPrice`) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items?.[index]?.sellerFixedPrice?.message })] })] })] }, field.id))) }), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: handleAppendItem, children: [_jsx(Plus, { className: "h-4 w-4" }), "Add item"] }) })] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { className: "p-4 sm:p-6", children: _jsx(CardTitle, { children: "Partner payable" }) }), _jsxs(CardContent, { className: "space-y-3 p-4 pt-0 sm:space-y-4 sm:p-6 sm:pt-0", children: [_jsx("div", { className: "rounded-2xl bg-muted/60 p-3 sm:p-4", children: _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Items" }), _jsx("p", { className: "mt-1 text-2xl font-semibold", children: fields.length })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Total qty" }), _jsx("p", { className: "mt-1 text-2xl font-semibold", children: totalReceivedQuantity })] })] }) }), _jsxs("div", { className: "rounded-2xl bg-muted/60 p-3 sm:p-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Total payable if all received items sell" }), _jsx("p", { className: "mt-2 text-3xl font-semibold", children: formatCurrency(payable) })] }), _jsx("div", { className: "rounded-2xl bg-muted/60 p-3 text-sm text-muted-foreground sm:p-4", children: "Received partner items stay payable only when sold. Unsold quantity can be returned back to the partner from the returns screen." }), _jsxs("div", { className: "flex flex-col-reverse gap-2 sm:flex-row", children: [_jsx(Button, { type: "button", variant: "outline", className: "sm:flex-1", disabled: isPending, onClick: handleCancel, children: "Cancel" }), _jsx(Button, { className: "sm:flex-1", type: "submit", disabled: isPending || !canSubmit, children: isPending ? "Saving..." : "Save intake" })] })] })] })] }), _jsx(Dialog, { open: isPartnerDialogOpen, onOpenChange: setPartnerDialogOpen, children: _jsxs(DialogContent, { className: "max-w-xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Add partner" }), _jsx(DialogDescription, { children: "Create a partner without leaving the received-stock screen." })] }), _jsx(PartnerForm, { submitLabel: "Save partner", refreshAfterSuccess: false, onCancel: () => setPartnerDialogOpen(false), onSuccess: (partner) => {
                                setSellerOptions((current) => [...current, partner].sort((left, right) => left.name.localeCompare(right.name)));
                                form.setValue("sellerId", partner.id, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                });
                                setPartnerDialogOpen(false);
                            } })] }) })] }));
}
