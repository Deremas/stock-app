"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as React from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;
const AlertDialogOverlay = React.forwardRef(({ className, ...props }, ref) => (_jsx(AlertDialogPrimitive.Overlay, { ref: ref, className: cn("fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm", className), ...props })));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;
const AlertDialogContent = React.forwardRef(({ className, ...props }, ref) => (_jsxs(AlertDialogPortal, { children: [_jsx(AlertDialogOverlay, {}), _jsx(AlertDialogPrimitive.Content, { ref: ref, className: cn("fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] max-w-md translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-border bg-background p-6 shadow-2xl", className), ...props })] })));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;
function AlertDialogHeader({ className, ...props }) {
    return _jsx("div", { className: cn("space-y-2", className), ...props });
}
function AlertDialogFooter({ className, ...props }) {
    return (_jsx("div", { className: cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className), ...props }));
}
const AlertDialogTitle = React.forwardRef(({ className, ...props }, ref) => (_jsx(AlertDialogPrimitive.Title, { ref: ref, className: cn("text-lg font-semibold tracking-tight", className), ...props })));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;
const AlertDialogDescription = React.forwardRef(({ className, ...props }, ref) => (_jsx(AlertDialogPrimitive.Description, { ref: ref, className: cn("text-sm text-muted-foreground", className), ...props })));
AlertDialogDescription.displayName =
    AlertDialogPrimitive.Description.displayName;
const AlertDialogAction = React.forwardRef(({ className, ...props }, ref) => (_jsx(AlertDialogPrimitive.Action, { ref: ref, className: cn(buttonVariants({ variant: "destructive" }), className), ...props })));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;
const AlertDialogCancel = React.forwardRef(({ className, ...props }, ref) => (_jsx(AlertDialogPrimitive.Cancel, { ref: ref, className: cn(buttonVariants({ variant: "outline" }), className), ...props })));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;
export { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, };
