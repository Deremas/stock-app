"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { createCustomerAction } from "@/lib/actions/customers";
import { customerCreateSchema, type CustomerCreateFormInput } from "@/lib/validation/customer";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CustomerFormProps = {
  onSuccess?: (customer: { id: string; name: string }) => void;
  onCancel?: () => void;
  submitLabel?: string;
  refreshAfterSuccess?: boolean;
  closeCreateDialogOnSuccess?: boolean;
};

export function CustomerForm({
  onSuccess,
  onCancel,
  submitLabel = "Save customer",
  refreshAfterSuccess = true,
  closeCreateDialogOnSuccess = false,
}: CustomerFormProps) {
  const router = useRouter();
  const createDialog = useCreateDialog();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<CustomerCreateFormInput>({
    resolver: zodResolver(customerCreateSchema),
    defaultValues: {
      name: "",
      phone: "",
      location: "",
      note: "",
    },
  });

  function handleReset() {
    setSubmitError(null);
    form.reset({
      name: "",
      phone: "",
      location: "",
      note: "",
    });
  }

  function onSubmit(values: CustomerCreateFormInput) {
    startTransition(async () => {
      setSubmitError(null);
      const result = await createCustomerAction(values);

      if (!result.success || !result.customer) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      handleReset();
      if (refreshAfterSuccess) {
        router.refresh();
      }
      onSuccess?.(result.customer);
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
          <Label htmlFor="customer-name">Customer name</Label>
          <Input id="customer-name" placeholder="Customer name" {...form.register("name")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer-phone">Phone</Label>
          <Input id="customer-phone" placeholder="+251..." {...form.register("phone")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="customer-location">Location</Label>
        <Input
          id="customer-location"
          placeholder="Store, area, or address"
          {...form.register("location")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="customer-note">Note</Label>
        <Textarea
          id="customer-note"
          rows={3}
          placeholder="Optional customer note"
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
