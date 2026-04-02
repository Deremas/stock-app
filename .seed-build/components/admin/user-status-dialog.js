"use client";
import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/components/ui/alert-dialog";
import { setUserActiveStateAction } from "@/lib/actions/users";
export function UserStatusDialog({ user, open }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    function closeDialog() {
        router.replace("/admin/users");
        router.refresh();
    }
    function handleConfirm() {
        if (!user) {
            return;
        }
        startTransition(async () => {
            const result = await setUserActiveStateAction({
                userId: user.id,
                isActive: !user.isActive,
            });
            if (!result.success) {
                toast.error(result.message);
                return;
            }
            toast.success(result.message);
            closeDialog();
        });
    }
    const nextLabel = user?.isActive ? "Deactivate" : "Activate";
    const pendingLabel = user?.isActive ? "Deactivating..." : "Activating...";
    return (_jsx(AlertDialog, { open: open, onOpenChange: (nextOpen) => (!nextOpen ? closeDialog() : null), children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsxs(AlertDialogTitle, { children: [nextLabel, " user?"] }), _jsx(AlertDialogDescription, { children: user
                                ? user.isActive
                                    ? `${user.name} will lose access immediately and any active sessions will be signed out. You can activate the account again later.`
                                    : `${user.name} will be able to sign in again with the same account details and branch assignments.`
                                : "The selected user could not be found." })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { disabled: isPending, children: "Cancel" }), _jsx(AlertDialogAction, { disabled: isPending || !user, onClick: handleConfirm, children: isPending ? pendingLabel : `${nextLabel} user` })] })] }) }));
}
