"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { createTransferAction } from "@/lib/actions/transfers";
import { formatCurrency } from "@/lib/utils";
import { transferSchema, } from "@/lib/validation/transfer";
function getOwnedBatchesForLine(options, sourceBranchId, productId) {
    if (!sourceBranchId || !productId) {
        return [];
    }
    return options.ownedBatches.filter((batch) => batch.branchId === sourceBranchId && batch.productId === productId);
}
function getDefaultValues(options) {
    const sourceBranch = options.branches[0];
    const destinationBranch = options.branches.find((branch) => branch.id !== sourceBranch?.id) ?? options.branches[1];
    const defaultProduct = options.products[0];
    const defaultBatch = getOwnedBatchesForLine(options, sourceBranch?.id, defaultProduct?.id)[0];
    return {
        sourceBranchId: sourceBranch?.id ?? "",
        destinationBranchId: destinationBranch?.id ?? "",
        transferAt: new Date().toISOString().slice(0, 16),
        note: "",
        items: [
            {
                productId: defaultProduct?.id ?? "",
                ownedBatchId: defaultBatch?.id ?? "",
                quantity: 1,
            },
        ],
    };
}
export function TransferForm({ options }) {
    const createDialog = useCreateDialog();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [submitError, setSubmitError] = useState(null);
    const defaultValues = getDefaultValues(options);
    const defaultProduct = options.products[0];
    const canSubmit = options.branches.length > 1 && options.products.length > 0;
    const form = useForm({
        resolver: zodResolver(transferSchema),
        defaultValues,
    });
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    });
    const sourceBranchId = form.watch("sourceBranchId");
    const items = form.watch("items");
    const previousSourceBranchId = useRef(defaultValues.sourceBranchId);
    const previousLineState = useRef(defaultValues.items.map((item) => ({
        productId: item.productId,
        ownedBatchId: item.ownedBatchId,
    })));
    useEffect(() => {
        const sourceChanged = sourceBranchId !== previousSourceBranchId.current;
        items.forEach((item, index) => {
            const previousLine = previousLineState.current[index];
            const availableBatches = getOwnedBatchesForLine(options, sourceBranchId, item.productId);
            const previousProductId = previousLine?.productId;
            const previousOwnedBatchId = previousLine?.ownedBatchId ?? "";
            const productChanged = item.productId !== previousProductId;
            const batchStillValid = availableBatches.some((batch) => batch.id === item.ownedBatchId);
            if (!batchStillValid) {
                form.setValue(`items.${index}.ownedBatchId`, availableBatches[0]?.id ?? "", {
                    shouldDirty: true,
                });
            }
            if (!productChanged && !sourceChanged && item.ownedBatchId === previousOwnedBatchId) {
                return;
            }
            if (availableBatches.length > 0 && item.ownedBatchId !== availableBatches[0]?.id) {
                form.setValue(`items.${index}.ownedBatchId`, availableBatches[0]?.id ?? "", {
                    shouldDirty: true,
                });
            }
        });
        previousSourceBranchId.current = sourceBranchId;
        previousLineState.current = items.map((item) => ({
            productId: item.productId,
            ownedBatchId: item.ownedBatchId,
        }));
    }, [form, items, options, sourceBranchId]);
    function handleCancel() {
        setSubmitError(null);
        form.reset(defaultValues);
        createDialog?.close();
    }
    function onSubmit(values) {
        startTransition(async () => {
            setSubmitError(null);
            const result = await createTransferAction(values);
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
    if (options.branches.length < 2) {
        return (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900", children: "Assign this user to at least two branches before creating transfers." }), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { type: "button", variant: "outline", onClick: () => createDialog?.close(), children: "Close" }) })] }));
    }
    return (_jsxs("form", { className: "grid gap-6 xl:grid-cols-[2fr_1fr]", onChangeCapture: () => {
            if (submitError) {
                setSubmitError(null);
            }
        }, onSubmit: form.handleSubmit(onSubmit), children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Transfer entry" }) }), _jsxs(CardContent, { className: "space-y-6", children: [_jsx(FormFeedback, { errors: form.formState.errors, submitError: submitError, showValidationSummary: form.formState.submitCount > 0 }), !canSubmit ? (_jsx("div", { className: "rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900", children: "Create active branches and items before posting transfers." })) : null, _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "sourceBranchId", children: "Source branch" }), _jsx(Select, { id: "sourceBranchId", ...form.register("sourceBranchId"), children: options.branches.map((branch) => (_jsxs("option", { value: branch.id, children: [branch.code, " - ", branch.name] }, branch.id))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "destinationBranchId", children: "Destination branch" }), _jsx(Select, { id: "destinationBranchId", ...form.register("destinationBranchId"), children: options.branches.map((branch) => (_jsxs("option", { value: branch.id, children: [branch.code, " - ", branch.name] }, branch.id))) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.destinationBranchId?.message })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "transferAt", children: "Transfer date" }), _jsx(Input, { id: "transferAt", type: "datetime-local", ...form.register("transferAt") })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "transfer-note", children: "Note" }), _jsx(Textarea, { id: "transfer-note", rows: 3, ...form.register("note") })] })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold uppercase tracking-wide text-muted-foreground", children: "Transfer lines" }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", disabled: options.products.length === 0, onClick: () => append({
                                                    productId: defaultProduct?.id ?? "",
                                                    ownedBatchId: getOwnedBatchesForLine(options, sourceBranchId, defaultProduct?.id)[0]?.id ?? "",
                                                    quantity: 1,
                                                }), children: [_jsx(Plus, { className: "h-4 w-4" }), "Add item"] })] }), _jsx("div", { className: "space-y-4", children: fields.map((field, index) => {
                                            const lineBatches = getOwnedBatchesForLine(options, sourceBranchId, items[index]?.productId);
                                            const selectedBatch = lineBatches.find((batch) => batch.id === items[index]?.ownedBatchId);
                                            return (_jsxs("div", { className: "rounded-2xl border border-border p-4", children: [_jsxs("div", { className: "grid gap-4 lg:grid-cols-[2fr_1.6fr_1fr_auto]", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Item" }), _jsx(Select, { ...form.register(`items.${index}.productId`), children: options.products.map((product) => (_jsx("option", { value: product.id, children: product.name }, product.id))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Batch" }), _jsxs(Select, { ...form.register(`items.${index}.ownedBatchId`), children: [_jsx("option", { value: "", children: "Select batch" }), lineBatches.map((batch) => (_jsxs("option", { value: batch.id, children: [batch.referenceNumber, " | ", batch.remainingQuantity, " left"] }, batch.id)))] }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items?.[index]?.ownedBatchId?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Qty" }), _jsx(Input, { type: "number", min: 1, ...form.register(`items.${index}.quantity`) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items?.[index]?.quantity?.message })] }), _jsx("div", { className: "flex items-end", children: _jsx(Button, { type: "button", variant: "ghost", size: "icon", onClick: () => remove(index), disabled: fields.length === 1, children: _jsx(Trash2, { className: "h-4 w-4" }) }) })] }), selectedBatch ? (_jsxs("div", { className: "mt-4 grid gap-2 rounded-2xl bg-muted/40 p-4 text-sm md:grid-cols-2 xl:grid-cols-4", children: [_jsxs("p", { children: ["Source: ", _jsx("span", { className: "font-medium", children: selectedBatch.sourceName })] }), _jsxs("p", { children: ["Remaining:", " ", _jsx("span", { className: "font-medium", children: selectedBatch.remainingQuantity })] }), _jsxs("p", { children: ["Buying Price:", " ", _jsx("span", { className: "font-medium", children: formatCurrency(selectedBatch.unitCost) })] }), _jsxs("p", { children: ["Selling Price:", " ", _jsx("span", { className: "font-medium", children: formatCurrency(selectedBatch.sellingPrice) })] })] })) : null] }, field.id));
                                        }) })] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Transfer summary" }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsx("div", { className: "rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground", children: "Transfer posting immediately moves stock out of the source branch and into the destination branch." }), _jsx("div", { className: "rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground", children: "The destination receives a real saleable owned batch with the same buying price and current selling price." }), _jsxs("div", { className: "flex flex-col-reverse gap-2 sm:flex-row", children: [_jsx(Button, { type: "button", variant: "outline", className: "sm:flex-1", disabled: isPending, onClick: handleCancel, children: "Cancel" }), _jsx(Button, { className: "sm:flex-1", type: "submit", disabled: isPending || !canSubmit, children: isPending ? "Saving..." : "Post transfer" })] })] })] })] }));
}
