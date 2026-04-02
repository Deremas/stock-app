"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormFeedback } from "@/components/forms/form-feedback";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createSellerAssignmentAction } from "@/lib/actions/seller-assignments";
import { formatCurrency } from "@/lib/utils";
import { sellerAssignmentSchema, } from "@/lib/validation/seller-assignment";
function getBatchesForBranch(options, branchId) {
    if (!branchId) {
        return [];
    }
    return options.ownedBatches.filter((batch) => batch.branchId === branchId);
}
function getDefaultValues(options, initialBatchId, initialSellerId) {
    const seededBatch = options.ownedBatches.find((batch) => batch.id === initialBatchId);
    const selectedBranch = options.branches.find((branch) => branch.id === seededBatch?.branchId) ??
        options.branches[0];
    const branchBatches = getBatchesForBranch(options, selectedBranch?.id);
    const defaultBatch = branchBatches.find((batch) => batch.id === initialBatchId) ?? branchBatches[0];
    return {
        branchId: selectedBranch?.id ?? "",
        sellerId: options.sellers.find((seller) => seller.id === initialSellerId)?.id ?? "",
        assignmentDate: new Date().toISOString().slice(0, 16),
        note: "",
        items: [
            {
                ownedBatchId: defaultBatch?.id ?? "",
                quantityAssigned: 1,
                sellingPrice: defaultBatch?.sellingPrice ?? 0,
            },
        ],
    };
}
export function SellerAssignmentForm({ options, initialBatchId, initialSellerId, }) {
    const createDialog = useCreateDialog();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [submitError, setSubmitError] = useState(null);
    const defaultValues = getDefaultValues(options, initialBatchId, initialSellerId);
    const hasBranches = options.branches.length > 0;
    const hasOwnedBatches = options.ownedBatches.length > 0;
    const hasSellers = options.sellers.length > 0;
    const canSubmit = hasBranches && hasOwnedBatches && hasSellers;
    const form = useForm({
        resolver: zodResolver(sellerAssignmentSchema),
        defaultValues,
    });
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    });
    const branchId = form.watch("branchId");
    const items = form.watch("items");
    const availableBranchBatches = getBatchesForBranch(options, branchId);
    const totalAssignedQuantity = items.reduce((sum, item) => sum + Number(item.quantityAssigned || 0), 0);
    const projectedSellerValue = items.reduce((sum, item) => sum + Number(item.quantityAssigned || 0) * Number(item.sellingPrice || 0), 0);
    const previousBranchId = useRef(defaultValues.branchId);
    const previousBatchIds = useRef(defaultValues.items.map((item) => item.ownedBatchId));
    useEffect(() => {
        const branchChanged = branchId !== previousBranchId.current;
        const branchBatches = getBatchesForBranch(options, branchId);
        const fallbackBatch = branchBatches[0];
        items.forEach((item, index) => {
            const previousBatchId = previousBatchIds.current[index] ?? "";
            const batchChanged = item.ownedBatchId !== previousBatchId;
            const batchStillValid = branchBatches.some((batch) => batch.id === item.ownedBatchId);
            const nextBatchId = batchStillValid ? item.ownedBatchId : fallbackBatch?.id ?? "";
            const selectedBatch = branchBatches.find((batch) => batch.id === nextBatchId);
            if (!batchStillValid && item.ownedBatchId !== nextBatchId) {
                form.setValue(`items.${index}.ownedBatchId`, nextBatchId, {
                    shouldDirty: true,
                });
            }
            if (!branchChanged && !batchChanged && item.ownedBatchId === nextBatchId) {
                return;
            }
            form.setValue(`items.${index}.sellingPrice`, selectedBatch?.sellingPrice ?? 0, {
                shouldDirty: true,
            });
        });
        previousBranchId.current = branchId;
        previousBatchIds.current = items.map((item) => item.ownedBatchId);
    }, [branchId, form, items, options]);
    function handleCancel() {
        setSubmitError(null);
        form.reset(defaultValues);
        createDialog?.close();
    }
    function onSubmit(values) {
        startTransition(async () => {
            setSubmitError(null);
            const result = await createSellerAssignmentAction(values);
            if (!result.success) {
                setSubmitError(result.message);
                toast.error(result.message);
                return;
            }
            setSubmitError(null);
            toast.success(result.message);
            form.reset(defaultValues);
            router.refresh();
            createDialog?.close();
        });
    }
    function handleAppendItem() {
        const nextBatch = availableBranchBatches[0];
        append({
            ownedBatchId: nextBatch?.id ?? "",
            quantityAssigned: 1,
            sellingPrice: nextBatch?.sellingPrice ?? 0,
        });
    }
    return (_jsxs("form", { className: "grid gap-3 sm:gap-6 xl:grid-cols-[2fr_1fr]", onChangeCapture: () => {
            if (submitError) {
                setSubmitError(null);
            }
        }, onSubmit: form.handleSubmit(onSubmit), children: [_jsxs(Card, { children: [_jsx(CardHeader, { className: "p-4 sm:p-6", children: _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsx(CardTitle, { children: "Partner assignment" }), !canSubmit ? (_jsx("p", { className: "text-[11px] font-medium text-muted-foreground sm:text-xs", children: "Need branch, partner, and available stock." })) : null] }) }), _jsxs(CardContent, { className: "space-y-4 p-4 pt-0 sm:space-y-6 sm:p-6 sm:pt-0", children: [_jsx(FormFeedback, { errors: form.formState.errors, submitError: submitError, showValidationSummary: form.formState.submitCount > 0 }), !hasOwnedBatches ? (_jsx("div", { className: "rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4", children: "No owned batches are available to assign in your branches yet." })) : !hasSellers ? (_jsx("div", { className: "rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4", children: "Add a partner first before posting an assignment." })) : !hasBranches ? (_jsx("div", { className: "rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4", children: "Add a branch first before posting an assignment." })) : null, _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "seller-assignment-branch", children: "Branch" }), _jsx(Select, { id: "seller-assignment-branch", ...form.register("branchId"), children: options.branches.map((branch) => (_jsxs("option", { value: branch.id, children: [branch.code, " - ", branch.name] }, branch.id))) }), form.formState.errors.branchId?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.branchId.message })) : null] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "seller-assignment-seller", children: "Partner" }), _jsxs(Select, { id: "seller-assignment-seller", ...form.register("sellerId"), children: [_jsx("option", { value: "", children: "Select partner" }), options.sellers.map((seller) => (_jsx("option", { value: seller.id, children: seller.name }, seller.id)))] }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.sellerId?.message })] })] }), _jsx("div", { className: "grid gap-3", children: _jsxs("div", { className: "w-full max-w-[18rem] space-y-2 sm:max-w-[19rem]", children: [_jsx(Label, { htmlFor: "seller-assignment-date", children: "Assignment date" }), _jsx(Input, { id: "seller-assignment-date", type: "datetime-local", ...form.register("assignmentDate") }), form.formState.errors.assignmentDate?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.assignmentDate.message })) : null] }) }), _jsxs("div", { className: "space-y-3 sm:space-y-4", children: [_jsx("div", { className: "flex flex-wrap items-center justify-between gap-2", children: _jsx("h3", { className: "text-sm font-semibold uppercase tracking-wide text-muted-foreground", children: "Assignment lines" }) }), _jsx("div", { className: "space-y-2.5 sm:space-y-4", children: fields.map((field, index) => {
                                            const selectedBatch = availableBranchBatches.find((batch) => batch.id === items[index]?.ownedBatchId);
                                            const currentQuantity = Number(items[index]?.quantityAssigned ?? 1);
                                            const maxQuantity = selectedBatch?.remainingQuantity ?? 0;
                                            return (_jsxs("div", { className: "rounded-2xl border border-primary/15 bg-primary/[0.035] p-3 dark:border-primary/20 dark:bg-primary/[0.08] sm:p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between gap-3", children: [_jsxs("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/85", children: ["Line ", index + 1] }), fields.length > 1 ? (_jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "h-8 shrink-0 rounded-lg border-destructive/35 bg-background/80 px-2.5 text-destructive shadow-sm hover:bg-destructive/10 hover:text-destructive", onClick: () => remove(index), children: [_jsx(Trash2, { className: "h-4 w-4" }), "Remove"] })) : null] }), _jsxs("div", { className: "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,2.8fr)_minmax(108px,0.9fr)_minmax(144px,1fr)] lg:items-start", children: [_jsxs("div", { className: "col-span-2 space-y-2 lg:col-span-1", children: [_jsx(Label, { className: "text-xs font-medium sm:text-sm", children: "Batch" }), _jsxs(Select, { ...form.register(`items.${index}.ownedBatchId`), children: [_jsx("option", { value: "", children: "Select available batch" }), availableBranchBatches.map((batch) => (_jsxs("option", { value: batch.id, children: [batch.productName, " | ", batch.referenceNumber, " | ", batch.remainingQuantity, " left"] }, batch.id)))] }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items?.[index]?.ownedBatchId?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-xs font-medium sm:text-sm", children: "Qty" }), _jsxs("div", { className: "flex items-center rounded-xl border border-border bg-background", children: [_jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-9 w-9 rounded-none rounded-l-xl sm:h-10 sm:w-10", disabled: currentQuantity <= 1, onClick: () => form.setValue(`items.${index}.quantityAssigned`, Math.max(1, currentQuantity - 1), { shouldDirty: true }), children: _jsx(Minus, { className: "h-4 w-4" }) }), _jsx(Input, { type: "number", min: 1, max: maxQuantity || undefined, className: "h-9 border-0 px-1 text-center shadow-none focus-visible:ring-0 sm:h-10", ...form.register(`items.${index}.quantityAssigned`) }), _jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-9 w-9 rounded-none rounded-r-xl sm:h-10 sm:w-10", disabled: maxQuantity > 0 ? currentQuantity >= maxQuantity : false, onClick: () => form.setValue(`items.${index}.quantityAssigned`, currentQuantity + 1, { shouldDirty: true }), children: _jsx(Plus, { className: "h-4 w-4" }) })] }), _jsx("p", { className: "text-[11px] text-muted-foreground sm:text-xs", children: maxQuantity > 0
                                                                            ? `${maxQuantity} available in this batch.`
                                                                            : "No quantity is left in this batch." }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items?.[index]?.quantityAssigned?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-xs font-medium sm:text-sm", children: "Partner Pays / Unit" }), _jsx(Input, { type: "number", min: 0, step: "0.01", ...form.register(`items.${index}.sellingPrice`) }), _jsx("p", { className: "text-[11px] text-muted-foreground sm:text-xs", children: "Use the amount the partner should remit for each sold unit from this assignment." }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items?.[index]?.sellingPrice?.message })] })] }), selectedBatch ? (_jsxs("div", { className: "mt-3 grid gap-2 rounded-2xl bg-background/80 p-3 text-[11px] text-muted-foreground sm:text-xs md:grid-cols-2 xl:grid-cols-4", children: [_jsxs("p", { children: ["Item:", " ", _jsx("span", { className: "font-medium text-foreground", children: selectedBatch.productName })] }), _jsxs("p", { children: ["Source:", " ", _jsxs("span", { className: "font-medium text-foreground", children: [selectedBatch.referenceNumber, " / ", selectedBatch.sourceName] })] }), _jsxs("p", { children: ["Buying Price:", " ", _jsx("span", { className: "font-medium text-foreground", children: formatCurrency(selectedBatch.unitCost) })] }), _jsxs("p", { children: ["Current Sell Price:", " ", _jsx("span", { className: "font-medium text-foreground", children: formatCurrency(selectedBatch.sellingPrice) })] })] })) : null] }, field.id));
                                        }) }), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "button", variant: "outline", size: "sm", disabled: availableBranchBatches.length === 0, onClick: handleAppendItem, children: [_jsx(Plus, { className: "h-4 w-4" }), "Add batch"] }) })] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { className: "p-4 sm:p-6", children: _jsx(CardTitle, { children: "Assignment summary" }) }), _jsxs(CardContent, { className: "space-y-3 p-4 pt-0 sm:space-y-4 sm:p-6 sm:pt-0", children: [_jsx("div", { className: "rounded-2xl bg-muted/60 p-3 sm:p-4", children: _jsxs("div", { className: "grid gap-3 sm:grid-cols-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Lines" }), _jsx("p", { className: "mt-1 text-2xl font-semibold", children: fields.length })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Units" }), _jsx("p", { className: "mt-1 text-2xl font-semibold", children: totalAssignedQuantity })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Collection value" }), _jsx("p", { className: "mt-1 text-xl font-semibold", children: formatCurrency(projectedSellerValue) })] })] }) }), _jsx("div", { className: "rounded-2xl bg-muted/60 p-3 text-sm text-muted-foreground sm:p-4", children: "Assigning stock moves quantity from owned inventory to the partner. Sold quantity is tracked per line, and unsold quantity can be returned back into branch stock later." }), _jsxs("div", { className: "flex flex-col-reverse gap-2 sm:flex-row", children: [_jsx(Button, { type: "button", variant: "outline", className: "sm:flex-1", disabled: isPending, onClick: handleCancel, children: "Cancel" }), _jsx(Button, { className: "sm:flex-1", type: "submit", disabled: isPending || !canSubmit, children: isPending ? "Saving..." : "Post assignment" })] })] })] })] }));
}
