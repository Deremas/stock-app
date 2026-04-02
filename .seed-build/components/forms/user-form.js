"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormFeedback } from "@/components/forms/form-feedback";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createUserAction, updateUserAction } from "@/lib/actions/users";
import { APP_ROLES } from "@/lib/rbac";
import { userSchema, userUpdateSchema, } from "@/lib/validation/user";
const createDefaultValues = {
    id: "",
    name: "",
    email: "",
    username: "",
    phone: "",
    password: "",
    role: "SALES",
    branchIds: [],
    defaultBranchId: "",
};
export function UserForm({ options, intent = "create", initialValues, }) {
    const createDialog = useCreateDialog();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [submitError, setSubmitError] = useState(null);
    const isEdit = intent === "edit";
    const defaultValues = useMemo(() => {
        const initialBranchIds = initialValues?.branchIds?.length
            ? initialValues.branchIds
            : options.branches[0]
                ? [options.branches[0].id]
                : [];
        const initialDefaultBranchId = initialValues?.defaultBranchId && initialBranchIds.includes(initialValues.defaultBranchId)
            ? initialValues.defaultBranchId
            : initialBranchIds[0] ?? "";
        return {
            ...createDefaultValues,
            branchIds: initialBranchIds,
            defaultBranchId: initialDefaultBranchId,
            ...(initialValues ?? {}),
        };
    }, [initialValues, options.branches]);
    const resolver = zodResolver(isEdit ? userUpdateSchema : userSchema);
    const form = useForm({
        resolver,
        defaultValues,
    });
    const selectedBranchIds = form.watch("branchIds");
    const availableDefaultBranches = options.branches.filter((branch) => selectedBranchIds.includes(branch.id));
    useEffect(() => {
        const currentDefaultBranchId = form.getValues("defaultBranchId");
        if (availableDefaultBranches.length > 0 &&
            !availableDefaultBranches.some((branch) => branch.id === currentDefaultBranchId)) {
            form.setValue("defaultBranchId", availableDefaultBranches[0]?.id ?? "", {
                shouldDirty: true,
            });
        }
        if (availableDefaultBranches.length === 0 && currentDefaultBranchId) {
            form.setValue("defaultBranchId", "", {
                shouldDirty: true,
            });
        }
    }, [availableDefaultBranches, form]);
    function handleCancel() {
        setSubmitError(null);
        form.reset(defaultValues);
        createDialog?.close();
    }
    function handleBranchToggle(branchId, checked) {
        const nextBranchIds = checked
            ? [...selectedBranchIds, branchId]
            : selectedBranchIds.filter((value) => value !== branchId);
        form.setValue("branchIds", nextBranchIds, {
            shouldDirty: true,
            shouldValidate: true,
        });
    }
    function onSubmit(values) {
        startTransition(async () => {
            setSubmitError(null);
            const result = isEdit
                ? await updateUserAction({
                    id: values.id,
                    name: values.name,
                    email: values.email,
                    username: values.username,
                    phone: values.phone,
                    password: values.password,
                    role: values.role,
                    branchIds: values.branchIds,
                    defaultBranchId: values.defaultBranchId,
                })
                : await createUserAction({
                    name: values.name,
                    email: values.email,
                    username: values.username,
                    phone: values.phone,
                    password: values.password,
                    role: values.role,
                    branchIds: values.branchIds,
                    defaultBranchId: values.defaultBranchId,
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
            createDialog?.close();
        });
    }
    if (options.branches.length === 0) {
        return (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Create at least one active branch before adding users." }), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { type: "button", variant: "outline", onClick: () => createDialog?.close(), children: "Close" }) })] }));
    }
    return (_jsxs("form", { className: "space-y-5", onChangeCapture: () => {
            if (submitError) {
                setSubmitError(null);
            }
        }, onSubmit: form.handleSubmit(onSubmit), children: [_jsx(FormFeedback, { errors: form.formState.errors, submitError: submitError, showValidationSummary: form.formState.submitCount > 0 }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Name is required. Add at least one login ID: email, username, or phone." }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "user-role", children: "Role" }), _jsx(Select, { id: "user-role", ...form.register("role"), children: APP_ROLES.map((role) => (_jsx("option", { value: role, children: role }, role))) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.role?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "user-default-branch", children: "Default branch" }), _jsx(Select, { id: "user-default-branch", ...form.register("defaultBranchId"), disabled: availableDefaultBranches.length === 0, children: availableDefaultBranches.map((branch) => (_jsx("option", { value: branch.id, children: branch.name }, branch.id))) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.defaultBranchId?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "user-name", children: "Name" }), _jsx(Input, { id: "user-name", placeholder: "Jane Doe", ...form.register("name") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.name?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "user-email", children: "Email (optional)" }), _jsx(Input, { id: "user-email", type: "email", placeholder: "jane@example.com", ...form.register("email") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.email?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "user-username", children: "Username (optional)" }), _jsx(Input, { id: "user-username", placeholder: "jane.doe", ...form.register("username") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.username?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "user-phone", children: "Phone (optional)" }), _jsx(Input, { id: "user-phone", placeholder: "+254700000000", ...form.register("phone") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.phone?.message })] }), _jsxs("div", { className: "space-y-2 md:col-span-2", children: [_jsx(Label, { htmlFor: "user-password", children: isEdit ? "Password (optional)" : "Password" }), _jsx(Input, { id: "user-password", type: "password", placeholder: isEdit ? "Leave blank to keep current password" : "Create a password", ...form.register("password") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.password?.message })] }), _jsxs("div", { className: "space-y-3 md:col-span-2", children: [_jsx(Label, { children: "Assigned branches" }), _jsx("div", { className: "grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-2", children: options.branches.map((branch) => {
                                    const checked = selectedBranchIds.includes(branch.id);
                                    return (_jsxs("label", { className: "flex items-start gap-3 rounded-xl border border-border/70 px-3 py-3", children: [_jsx("input", { type: "checkbox", className: "mt-1 h-4 w-4 rounded border-border", checked: checked, onChange: (event) => handleBranchToggle(branch.id, event.target.checked) }), _jsxs("span", { className: "min-w-0", children: [_jsx("span", { className: "block text-sm font-medium", children: branch.name }), _jsx("span", { className: "block text-xs text-muted-foreground", children: branch.code })] })] }, branch.id));
                                }) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Assign one branch for a branch-specific user, or multiple branches for a manager who needs to switch between them." }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.branchIds?.message })] })] }), _jsxs("div", { className: "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", children: [_jsx(Button, { type: "button", variant: "outline", disabled: isPending, onClick: handleCancel, children: "Cancel" }), _jsx(Button, { type: "submit", disabled: isPending, children: isPending ? "Saving..." : isEdit ? "Save changes" : "Save user" })] })] }));
}
