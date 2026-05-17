"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { createSellerAction } from "@/lib/actions/seller-master";
import { sellerCreateSchema, type SellerCreateFormInput } from "@/lib/validation/seller-master";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SellerFormProps = {
  onSuccess?: (seller: { id: string; name: string }) => void;
  onCancel?: () => void;
  submitLabel?: string;
  refreshAfterSuccess?: boolean;
  closeCreateDialogOnSuccess?: boolean;
};

export function SellerForm({
  onSuccess,
  onCancel,
  submitLabel = "Save seller",
  refreshAfterSuccess = true,
  closeCreateDialogOnSuccess = false,
}: SellerFormProps) {
  const router = useRouter();
  const createDialog = useCreateDialog();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<SellerCreateFormInput>({
    resolver: zodResolver(sellerCreateSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      location: "",
      note: "",
    },
  });

  function handleReset() {
    setSubmitError(null);
    form.reset({
      fullName: "",
      phone: "",
      location: "",
      note: "",
    });
  }

  function onSubmit(values: SellerCreateFormInput) {
    startTransition(async () => {
      setSubmitError(null);
      const result = await createSellerAction(values);

      if (!result.success || !result.seller) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      handleReset();
      if (refreshAfterSuccess) {
        router.refresh();
      }
      onSuccess?.(result.seller);
      if (closeCreateDialogOnSuccess) {
        createDialog?.close();
      }
    });
  }

  return (
    <form
      className="space-y-4"
      onChangeCapture={() => {
        if (submitError) {
          setSubmitError(null);
        }
      }}
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FormFeedback
        errors={form.formState.errors}
        submitError={submitError}
        showValidationSummary={form.formState.submitCount > 0}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="seller-full-name">Seller name</Label>
          <Input
            id="seller-full-name"
            placeholder="Seller name"
            {...form.register("fullName")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="seller-phone">Phone (optional)</Label>
          <Input
            id="seller-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+251..."
            {...form.register("phone")}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="seller-location">Location</Label>
        <Input
          id="seller-location"
          placeholder="Area, shop, or address"
          {...form.register("location")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="seller-note">Note</Label>
        <Textarea
          id="seller-note"
          rows={3}
          placeholder="Optional seller note"
          {...form.register("note")}
        />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            handleReset();
            if (closeCreateDialogOnSuccess) {
              createDialog?.close();
            }
            onCancel?.();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
