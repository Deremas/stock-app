"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormFeedback } from "@/components/forms/form-feedback";
import { authClient } from "@/lib/auth/client";
import { loginSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
function normalizePhoneIdentifier(value) {
    return value.replace(/\D/g, "");
}
function getIdentifierKind(identifier) {
    const trimmed = identifier.trim();
    if (trimmed.includes("@")) {
        return "email";
    }
    const phoneDigits = normalizePhoneIdentifier(trimmed);
    const isPhoneCandidate = phoneDigits.length >= 7 && !/[a-z]/i.test(trimmed);
    return isPhoneCandidate ? "phone" : "username";
}
function normalizeLoginError(error, identifierKind) {
    const fallback = "Unable to sign in with those credentials.";
    if (!error) {
        return fallback;
    }
    const stringValue = typeof error === "string"
        ? error
        : error instanceof Error
            ? error.message
            : null;
    const errorObject = typeof error === "object" && error !== null
        ? error
        : null;
    const messageCandidate = [
        stringValue,
        typeof errorObject?.message === "string" ? errorObject.message : null,
        typeof errorObject?.statusText === "string" ? errorObject.statusText : null,
        typeof errorObject?.error === "string" ? errorObject.error : null,
        typeof errorObject?.error === "object" &&
            errorObject.error !== null &&
            "message" in errorObject.error &&
            typeof errorObject.error.message === "string"
            ? errorObject.error.message
            : null,
    ].find((value) => typeof value === "string" && value.trim().length > 0);
    const codeCandidate = [
        typeof errorObject?.code === "string" ? errorObject.code : null,
        typeof errorObject?.error === "object" &&
            errorObject.error !== null &&
            "code" in errorObject.error &&
            typeof errorObject.error.code === "string"
            ? errorObject.error.code
            : null,
    ].find((value) => typeof value === "string" && value.trim().length > 0);
    const statusCandidate = typeof errorObject?.status === "number"
        ? errorObject.status
        : typeof errorObject?.status === "string"
            ? Number(errorObject.status)
            : null;
    const message = messageCandidate ?? fallback;
    const normalized = `${message} ${codeCandidate ?? ""}`.trim().toLowerCase();
    if (statusCandidate === 500 ||
        normalized.includes("internal server error") ||
        normalized.includes("service unavailable") ||
        normalized.includes("temporarily unavailable") ||
        normalized.includes("connection timeout") ||
        normalized.includes("connection terminated") ||
        normalized.includes("can't reach database server")) {
        return "Sign-in is temporarily unavailable. Please try again in a moment.";
    }
    if (normalized.includes("email_not_found") ||
        normalized.includes("email is incorrect")) {
        return "Email is incorrect.";
    }
    if (normalized.includes("phone_not_found") ||
        normalized.includes("phone number is incorrect")) {
        return "Phone number is incorrect.";
    }
    if (normalized.includes("username_not_found") ||
        normalized.includes("username is incorrect")) {
        return "Username is incorrect.";
    }
    if (normalized.includes("invalid password") ||
        normalized.includes("password is incorrect") ||
        normalized.includes("invalid username or password") ||
        normalized.includes("invalid email or password") ||
        normalized.includes("invalid_credentials")) {
        return "Password is incorrect.";
    }
    if (statusCandidate === 401 ||
        normalized.includes("user not found") ||
        normalized.includes("unauthorized") ||
        normalized.includes("status code 401")) {
        if (identifierKind === "email") {
            return "Email is incorrect.";
        }
        if (identifierKind === "phone") {
            return "Phone number is incorrect.";
        }
        return "Username is incorrect.";
    }
    if (normalized.includes("inactive")) {
        return "This account is inactive. Contact an administrator.";
    }
    if (normalized.includes("email not verified")) {
        return "This account email is not verified yet.";
    }
    if (normalized.includes("multiple accounts")) {
        return "This phone number matches multiple accounts. Sign in with username or email.";
    }
    return message || fallback;
}
export function LoginForm({ redirectTo = "/dashboard" }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [authError, setAuthError] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const form = useForm({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            identifier: "",
            password: "",
        },
    });
    function onSubmit(values) {
        startTransition(async () => {
            try {
                const identifier = values.identifier.trim();
                const identifierKind = getIdentifierKind(identifier);
                setAuthError(null);
                const response = identifierKind === "email"
                    ? await authClient.signIn.email({
                        email: identifier,
                        password: values.password,
                        rememberMe: true,
                        callbackURL: redirectTo,
                    })
                    : await authClient.signIn.username({
                        username: identifier,
                        password: values.password,
                        rememberMe: true,
                        callbackURL: redirectTo,
                    });
                if (response.error) {
                    const message = normalizeLoginError(response.error, identifierKind);
                    setAuthError(message);
                    toast.error(message);
                    return;
                }
                toast.success("Signed in successfully.");
                router.push(redirectTo);
                router.refresh();
            }
            catch (error) {
                const message = normalizeLoginError(error, getIdentifierKind(values.identifier));
                setAuthError(message);
                toast.error(message);
            }
        });
    }
    return (_jsxs("form", { className: "space-y-3.5 sm:space-y-4", onChangeCapture: () => {
            if (authError) {
                setAuthError(null);
            }
        }, onSubmit: form.handleSubmit(onSubmit), children: [_jsx(FormFeedback, { errors: form.formState.errors, submitError: authError, showValidationSummary: form.formState.submitCount > 0 }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-sm font-semibold text-slate-800", htmlFor: "identifier", children: "Email, Username, or Phone" }), _jsx(Input, { className: "h-10 rounded-xl border-slate-300 bg-white text-slate-900 shadow-sm placeholder:text-slate-500 focus-visible:ring-primary/85 focus-visible:ring-offset-0 sm:h-11", id: "identifier", placeholder: "name@example.com, username, or phone", ...form.register("identifier") }), form.formState.errors.identifier?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.identifier.message })) : null] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-sm font-semibold text-slate-800", htmlFor: "password", children: "Password" }), _jsxs("div", { className: "relative", children: [_jsx(Input, { className: "h-10 rounded-xl border-slate-300 bg-white pr-12 text-slate-900 shadow-sm placeholder:text-slate-500 focus-visible:ring-primary/85 focus-visible:ring-offset-0 sm:h-11", id: "password", type: showPassword ? "text" : "password", ...form.register("password") }), _jsx("button", { type: "button", className: "absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition hover:text-slate-700", onClick: () => setShowPassword((current) => !current), "aria-label": showPassword ? "Hide password" : "Show password", "aria-pressed": showPassword, children: showPassword ? _jsx(EyeOff, { className: "h-4 w-4" }) : _jsx(Eye, { className: "h-4 w-4" }) })] }), form.formState.errors.password?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.password.message })) : null] }), _jsx(Button, { className: "h-10 w-full rounded-xl shadow-sm sm:h-11", type: "submit", disabled: isPending, children: isPending ? "Signing in..." : "Sign in" })] }));
}
