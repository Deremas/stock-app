"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/components/ui/alert-dialog";
import { deleteProductAction } from "@/lib/actions/products";
export function ProductDeleteDialog({ product, open, }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    function closeDialog() {
        router.replace("/inventory/products");
        router.refresh();
    }
    function handleDelete() {
        if (!product) {
            return;
        }
        startTransition(async () => {
            const result = await deleteProductAction({ id: product.id });
            if (!result.success) {
                toast.error(result.message);
                return;
            }
            toast.success(result.message);
            closeDialog();
        });
    }
    return (_jsx(AlertDialog, { open: open, onOpenChange: (nextOpen) => (!nextOpen ? closeDialog() : null), children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "Delete item?" }), _jsx(AlertDialogDescription, { children: product
                                ? `${product.name} will be removed permanently. Used items with stock or transaction history cannot be deleted.`
                                : "The selected item could not be found." })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { disabled: isPending, children: "Cancel" }), _jsx(AlertDialogAction, { disabled: isPending || !product, onClick: handleDelete, children: isPending ? "Deleting..." : "Delete item" })] })] }) }));
}
