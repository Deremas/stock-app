"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createCustomerAction } from "@/lib/actions/customers";
import { customerCreateSchema } from "@/lib/validation/customer";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
export function CustomerForm({ onSuccess, onCancel, submitLabel = "Save customer", refreshAfterSuccess = true, closeCreateDialogOnSuccess = false, }) {
    const router = useRouter();
    const createDialog = useCreateDialog();
    const [isPending, startTransition] = useTransition();
    const [submitError, setSubmitError] = useState(null);
    const form = useForm({
        resolver: zodResolver(customerCreateSchema),
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
            const result = await createCustomerAction(values);
            if (!result.success || !result.customer) {
                setSubmitError(result.message);
                toast.error(result.message);
                return;
            }
            toast.success(result.message);
            handleReset();
            if (refreshAfterSuccess) {
                router.refresh();
            }
            onSuccess?.(result.customer);
            if (closeCreateDialogOnSuccess) {
                createDialog?.close();
            }
        });
    }
    return (_jsxs("form", { className: "space-y-4", onChangeCapture: () => {
            if (submitError) {
                setSubmitError(null);
            }
        }, onSubmit: form.handleSubmit(onSubmit), children: [_jsx(FormFeedback, { errors: form.formState.errors, submitError: submitError, showValidationSummary: form.formState.submitCount > 0 }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "customer-name", children: "Customer name" }), _jsx(Input, { id: "customer-name", placeholder: "Customer name", ...form.register("name") })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "customer-phone", children: "Phone" }), _jsx(Input, { id: "customer-phone", placeholder: "+251...", ...form.register("phone") })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "customer-location", children: "Location" }), _jsx(Input, { id: "customer-location", placeholder: "Store, area, or address", ...form.register("location") })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "customer-note", children: "Note" }), _jsx(Textarea, { id: "customer-note", rows: 3, placeholder: "Optional customer note", ...form.register("note") })] }), _jsxs("div", { className: "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", children: [_jsx(Button, { type: "button", variant: "outline", disabled: isPending, onClick: () => {
                            handleReset();
                            if (closeCreateDialogOnSuccess) {
                                createDialog?.close();
                            }
                            onCancel?.();
                        }, children: "Cancel" }), _jsx(Button, { type: "submit", disabled: isPending, children: isPending ? "Saving..." : submitLabel })] })] }));
}
