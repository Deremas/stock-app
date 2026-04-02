"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormFeedback } from "@/components/forms/form-feedback";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProductAction, updateProductAction, } from "@/lib/actions/products";
import { productEditorSchema, } from "@/lib/validation/product";
const createDefaultValues = {
    id: "",
    name: "",
    minimumStockAlert: 0,
    unit: "pcs",
    description: "",
};
export function ProductForm({ intent = "create", initialValues, mode = "page", cancelHref, onCancel, onSuccess, }) {
    const createDialog = useCreateDialog();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [submitError, setSubmitError] = useState(null);
    const defaultValues = useMemo(() => ({
        ...createDefaultValues,
        ...(initialValues ?? {}),
    }), [initialValues]);
    const form = useForm({
        resolver: zodResolver(productEditorSchema),
        defaultValues,
    });
    const isEdit = intent === "edit";
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
            const result = isEdit
                ? await updateProductAction({
                    id: values.id ?? "",
                    name: values.name,
                    minimumStockAlert: values.minimumStockAlert,
                    unit: values.unit,
                    description: values.description,
                })
                : await createProductAction({
                    name: values.name,
                    minimumStockAlert: values.minimumStockAlert,
                    unit: values.unit,
                    description: values.description,
                });
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
    return (_jsxs("form", { className: "space-y-5", onChangeCapture: () => {
            if (submitError) {
                setSubmitError(null);
            }
        }, onSubmit: form.handleSubmit(onSubmit), children: [_jsx(FormFeedback, { errors: form.formState.errors, submitError: submitError, showValidationSummary: form.formState.submitCount > 0 }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2 md:col-span-2", children: [_jsx(Label, { htmlFor: "item-name", children: "Item name" }), _jsx(Input, { id: "item-name", placeholder: "USB Cable", ...form.register("name") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.name?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "item-alert", children: "Low stock alert" }), _jsx(Input, { id: "item-alert", type: "number", min: 0, ...form.register("minimumStockAlert") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.minimumStockAlert?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "item-unit", children: "Unit" }), _jsx(Input, { id: "item-unit", placeholder: "pcs", ...form.register("unit") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.unit?.message })] }), _jsxs("div", { className: "space-y-2 md:col-span-2", children: [_jsx(Label, { htmlFor: "item-description", children: "Description" }), _jsx(Textarea, { id: "item-description", rows: 3, placeholder: "Optional note about this item", ...form.register("description") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.description?.message })] })] }), _jsxs("div", { className: "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", children: [_jsx(Button, { type: "button", variant: "outline", disabled: isPending, onClick: handleCancel, children: "Cancel" }), _jsx(Button, { type: "submit", disabled: isPending, children: isPending ? "Saving..." : isEdit ? "Save changes" : "Save item" })] })] }));
}
