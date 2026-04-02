"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormFeedback } from "@/components/forms/form-feedback";
import { changeOwnPasswordAction, updateOwnProfileAction, } from "@/lib/actions/profile";
import { profileNameSchema, profilePasswordSchema, } from "@/lib/validation/profile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function ProfileSettingsForm({ user }) {
    const router = useRouter();
    const [isSavingProfile, startProfileTransition] = useTransition();
    const [isSavingPassword, startPasswordTransition] = useTransition();
    const [profileError, setProfileError] = useState(null);
    const [passwordError, setPasswordError] = useState(null);
    const profileForm = useForm({
        resolver: zodResolver(profileNameSchema),
        defaultValues: {
            name: user.name,
        },
    });
    const passwordForm = useForm({
        resolver: zodResolver(profilePasswordSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    });
    function onSubmitProfile(values) {
        startProfileTransition(async () => {
            setProfileError(null);
            const result = await updateOwnProfileAction(values);
            if (!result.success) {
                setProfileError(result.message);
                toast.error(result.message);
                return;
            }
            setProfileError(null);
            toast.success(result.message);
            router.refresh();
        });
    }
    function onSubmitPassword(values) {
        startPasswordTransition(async () => {
            setPasswordError(null);
            const result = await changeOwnPasswordAction(values);
            if (!result.success) {
                setPasswordError(result.message);
                toast.error(result.message);
                return;
            }
            setPasswordError(null);
            toast.success(result.message);
            passwordForm.reset({
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
            });
            router.refresh();
        });
    }
    return (_jsxs("div", { className: "grid gap-6 xl:grid-cols-2", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Profile" }), _jsx(CardDescription, { children: "Update your own display name here." })] }), _jsxs(CardContent, { className: "space-y-5", children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "profile-login-id", children: "Login ID" }), _jsx(Input, { id: "profile-login-id", value: user.username, readOnly: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "profile-role", children: "Role" }), _jsx(Input, { id: "profile-role", value: user.role, readOnly: true })] })] }), _jsxs("form", { className: "space-y-4", onChangeCapture: () => {
                                    if (profileError) {
                                        setProfileError(null);
                                    }
                                }, onSubmit: profileForm.handleSubmit(onSubmitProfile), children: [_jsx(FormFeedback, { errors: profileForm.formState.errors, submitError: profileError, showValidationSummary: profileForm.formState.submitCount > 0 }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "profile-name", children: "Name" }), _jsx(Input, { id: "profile-name", ...profileForm.register("name") }), _jsx("p", { className: "text-xs text-destructive", children: profileForm.formState.errors.name?.message })] }), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { type: "submit", disabled: isSavingProfile, children: isSavingProfile ? "Saving..." : "Save profile" }) })] })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Change Password" }), _jsx(CardDescription, { children: "Update your own password with your current password." })] }), _jsx(CardContent, { children: _jsxs("form", { className: "space-y-4", onChangeCapture: () => {
                                if (passwordError) {
                                    setPasswordError(null);
                                }
                            }, onSubmit: passwordForm.handleSubmit(onSubmitPassword), children: [_jsx(FormFeedback, { errors: passwordForm.formState.errors, submitError: passwordError, showValidationSummary: passwordForm.formState.submitCount > 0 }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "current-password", children: "Current password" }), _jsx(Input, { id: "current-password", type: "password", ...passwordForm.register("currentPassword") }), _jsx("p", { className: "text-xs text-destructive", children: passwordForm.formState.errors.currentPassword?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "new-password", children: "New password" }), _jsx(Input, { id: "new-password", type: "password", ...passwordForm.register("newPassword") }), _jsx("p", { className: "text-xs text-destructive", children: passwordForm.formState.errors.newPassword?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "confirm-password", children: "Confirm new password" }), _jsx(Input, { id: "confirm-password", type: "password", ...passwordForm.register("confirmPassword") }), _jsx("p", { className: "text-xs text-destructive", children: passwordForm.formState.errors.confirmPassword?.message })] }), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { type: "submit", disabled: isSavingPassword, children: isSavingPassword ? "Saving..." : "Change password" }) })] }) })] })] }));
}
