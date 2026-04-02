"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;
const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (_jsx(DialogPrimitive.Overlay, { ref: ref, className: cn("fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm", className), ...props })));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;
const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => (_jsxs(DialogPortal, { children: [_jsx(DialogOverlay, {}), _jsxs(DialogPrimitive.Content, { ref: ref, className: cn("fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-border bg-background p-6 shadow-2xl", className), ...props, children: [children, _jsxs(DialogPrimitive.Close, { className: "absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground", children: [_jsx(X, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: "Close" })] })] })] })));
DialogContent.displayName = DialogPrimitive.Content.displayName;
function DialogHeader({ className, ...props }) {
    return _jsx("div", { className: cn("space-y-2", className), ...props });
}
function DialogFooter({ className, ...props }) {
    return (_jsx("div", { className: cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className), ...props }));
}
const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (_jsx(DialogPrimitive.Title, { ref: ref, className: cn("text-lg font-semibold tracking-tight", className), ...props })));
DialogTitle.displayName = DialogPrimitive.Title.displayName;
const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (_jsx(DialogPrimitive.Description, { ref: ref, className: cn("text-sm text-muted-foreground", className), ...props })));
DialogDescription.displayName = DialogPrimitive.Description.displayName;
export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogPortal, DialogTitle, DialogTrigger, };
