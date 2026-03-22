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
import { setUserActiveStateAction } from "@/lib/actions/users";

type UserStatusDialogProps = {
  user: {
    id: string;
    name: string;
    isActive: boolean;
  } | null;
  open: boolean;
};

export function UserStatusDialog({ user, open }: UserStatusDialogProps) {
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

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? closeDialog() : null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{nextLabel} user?</AlertDialogTitle>
          <AlertDialogDescription>
            {user
              ? user.isActive
                ? `${user.name} will lose access immediately and any active sessions will be signed out. You can activate the account again later.`
                : `${user.name} will be able to sign in again with the same account details and branch assignments.`
              : "The selected user could not be found."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isPending || !user} onClick={handleConfirm}>
            {isPending ? pendingLabel : `${nextLabel} user`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
