"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/components/ui/alert-dialog";
import { deleteUserAction } from "@/lib/actions/users";
export function UserDeleteDialog({ user, open }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    function closeDialog() {
        router.replace("/admin/users");
        router.refresh();
    }
    function handleDelete() {
        if (!user) {
            return;
        }
        startTransition(async () => {
            const result = await deleteUserAction({ userId: user.id });
            if (!result.success) {
                toast.error(result.message);
                return;
            }
            toast.success(result.message);
            closeDialog();
        });
    }
    return (_jsx(AlertDialog, { open: open, onOpenChange: (nextOpen) => (!nextOpen ? closeDialog() : null), children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "Delete user?" }), _jsx(AlertDialogDescription, { children: user
                                ? `${user.name} will lose login access, sessions, and branch assignments. Their past sales, purchases, expenses, and audit history will stay in the system.`
                                : "The selected user could not be found." })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { disabled: isPending, children: "Cancel" }), _jsx(AlertDialogAction, { disabled: isPending || !user, onClick: handleDelete, children: isPending ? "Deleting..." : "Delete user" })] })] }) }));
}
