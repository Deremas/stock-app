"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { createPartnerAction } from "@/lib/actions/partners";
import { partnerCreateSchema, type PartnerCreateFormInput } from "@/lib/validation/partner";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type PartnerFormProps = {
  onSuccess?: (partner: { id: string; name: string }) => void;
  onCancel?: () => void;
  submitLabel?: string;
  refreshAfterSuccess?: boolean;
  closeCreateDialogOnSuccess?: boolean;
};

export function PartnerForm({
  onSuccess,
  onCancel,
  submitLabel = "Save partner",
  refreshAfterSuccess = true,
  closeCreateDialogOnSuccess = false,
}: PartnerFormProps) {
  const router = useRouter();
  const createDialog = useCreateDialog();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<PartnerCreateFormInput>({
    resolver: zodResolver(partnerCreateSchema),
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

  function onSubmit(values: PartnerCreateFormInput) {
    startTransition(async () => {
      setSubmitError(null);
      const result = await createPartnerAction(values);

      if (!result.success || !result.partner) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      handleReset();
      if (refreshAfterSuccess) {
        router.refresh();
      }
      onSuccess?.(result.partner);
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
          <Label htmlFor="partner-full-name">Partner name</Label>
          <Input
            id="partner-full-name"
            placeholder="Partner name"
            {...form.register("fullName")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="partner-phone">Phone</Label>
          <Input id="partner-phone" placeholder="+251..." {...form.register("phone")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="partner-location">Location</Label>
        <Input
          id="partner-location"
          placeholder="Area, shop, or address"
          {...form.register("location")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="partner-note">Note</Label>
        <Textarea
          id="partner-note"
          rows={3}
          placeholder="Optional partner note"
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
