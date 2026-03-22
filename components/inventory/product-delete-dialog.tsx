"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteProductAction } from "@/lib/actions/products";

type ProductDeleteDialogProps = {
  product: {
    id: string;
    name: string;
  } | null;
  open: boolean;
};

export function ProductDeleteDialog({
  product,
  open,
}: ProductDeleteDialogProps) {
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

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? closeDialog() : null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete item?</AlertDialogTitle>
          <AlertDialogDescription>
            {product
              ? `${product.name} will be removed permanently. Used items with stock or transaction history cannot be deleted.`
              : "The selected item could not be found."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isPending || !product} onClick={handleDelete}>
            {isPending ? "Deleting..." : "Delete item"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
