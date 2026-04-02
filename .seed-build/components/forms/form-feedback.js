"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlertCircle } from "lucide-react";
function collectMessages(value, messages) {
    if (!value || typeof value !== "object") {
        return;
    }
    if ("message" in value &&
        typeof value.message === "string") {
        const message = value.message.trim();
        if (message) {
            messages.add(message);
        }
    }
    if (Array.isArray(value)) {
        value.forEach((item) => collectMessages(item, messages));
        return;
    }
    Object.entries(value).forEach(([key, nested]) => {
        if (key === "message" || key === "ref" || key === "type") {
            return;
        }
        collectMessages(nested, messages);
    });
}
export function getFormErrorMessages(errors) {
    const messages = new Set();
    collectMessages(errors, messages);
    return [...messages];
}
export function FormFeedback({ errors, submitError, showValidationSummary = false, }) {
    const validationMessages = showValidationSummary
        ? getFormErrorMessages(errors)
        : [];
    if (!submitError && validationMessages.length === 0) {
        return null;
    }
    return (_jsxs("div", { className: "space-y-3", children: [submitError ? (_jsx("div", { className: "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700", children: submitError })) : null, validationMessages.length > 0 ? (_jsx("div", { className: "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx(AlertCircle, { className: "mt-0.5 h-4 w-4 shrink-0" }), _jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "font-medium", children: "Check the missing or invalid details below." }), _jsx("ul", { className: "list-disc space-y-1 pl-4", children: validationMessages.map((message) => (_jsx("li", { children: message }, message))) })] })] }) })) : null] }));
}
