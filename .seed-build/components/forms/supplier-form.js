"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createSupplierAction } from "@/lib/actions/suppliers";
import { supplierCreateSchema } from "@/lib/validation/supplier";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
export function SupplierForm({ onSuccess, onCancel, submitLabel = "Save supplier", refreshAfterSuccess = true, closeCreateDialogOnSuccess = false, }) {
    const router = useRouter();
    const createDialog = useCreateDialog();
    const [isPending, startTransition] = useTransition();
    const [submitError, setSubmitError] = useState(null);
    const form = useForm({
        resolver: zodResolver(supplierCreateSchema),
        defaultValues: {
            name: "",
            phone: "",
            location: "",
            note: "",
        },
    });
    function handleReset() {
        setSubmitError(null);
        form.reset({
            name: "",
            phone: "",
            location: "",
            note: "",
        });
    }
    function onSubmit(values) {
        startTransition(async () => {
            setSubmitError(null);
            const result = await createSupplierAction(values);
            if (!result.success || !result.supplier) {
                setSubmitError(result.message);
                toast.error(result.message);
                return;
            }
            toast.success(result.message);
            handleReset();
            if (refreshAfterSuccess) {
                router.refresh();
            }
            onSuccess?.(result.supplier);
            if (closeCreateDialogOnSuccess) {
                createDialog?.close();
            }
        });
    }
    return (_jsxs("form", { className: "space-y-4", onChangeCapture: () => {
            if (submitError) {
                setSubmitError(null);
            }
        }, onSubmit: form.handleSubmit(onSubmit), children: [_jsx(FormFeedback, { errors: form.formState.errors, submitError: submitError, showValidationSummary: form.formState.submitCount > 0 }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "supplier-name", children: "Supplier name" }), _jsx(Input, { id: "supplier-name", placeholder: "Supplier name", ...form.register("name") })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "supplier-phone", children: "Phone" }), _jsx(Input, { id: "supplier-phone", placeholder: "+251...", ...form.register("phone") })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "supplier-location", children: "Location" }), _jsx(Input, { id: "supplier-location", placeholder: "Store, area, or address", ...form.register("location") })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "supplier-note", children: "Note" }), _jsx(Textarea, { id: "supplier-note", rows: 3, placeholder: "Optional supplier note", ...form.register("note") })] }), _jsxs("div", { className: "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", children: [_jsx(Button, { type: "button", variant: "outline", disabled: isPending, onClick: () => {
                            handleReset();
                            if (closeCreateDialogOnSuccess) {
                                createDialog?.close();
                            }
                            onCancel?.();
                        }, children: "Cancel" }), _jsx(Button, { type: "submit", disabled: isPending, children: isPending ? "Saving..." : submitLabel })] })] }));
}
