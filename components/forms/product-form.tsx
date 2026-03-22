"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createProductAction,
  updateProductAction,
} from "@/lib/actions/products";
import {
  productEditorSchema,
  type ProductEditorFormInput,
  type ProductEditorInput,
} from "@/lib/validation/product";

type ProductFormProps = {
  intent?: "create" | "edit";
  initialValues?: ProductEditorFormInput;
  mode?: "page" | "modal";
  cancelHref?: Route;
  onCancel?: () => void;
  onSuccess?: () => void;
};

const createDefaultValues: ProductEditorFormInput = {
  id: "",
  name: "",
  minimumStockAlert: 0,
  unit: "pcs",
  description: "",
};

export function ProductForm({
  intent = "create",
  initialValues,
  mode = "page",
  cancelHref,
  onCancel,
  onSuccess,
}: ProductFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = useMemo(
    () => ({
      ...createDefaultValues,
      ...(initialValues ?? {}),
    }),
    [initialValues],
  );
  const form = useForm<ProductEditorFormInput, undefined, ProductEditorInput>({
    resolver: zodResolver(productEditorSchema),
    defaultValues,
  });
  const isEdit = intent === "edit";

  function handleCancel() {
    setSubmitError(null);
    form.reset(defaultValues);

    if (mode === "page") {
      onCancel?.();

      if (cancelHref) {
        router.push(cancelHref);
      } else {
        router.back();
      }

      return;
    }

    onCancel?.();
    createDialog?.close();
  }

  function onSubmit(values: ProductEditorInput) {
    startTransition(async () => {
      setSubmitError(null);
      const result = isEdit
        ? await updateProductAction({
            id: values.id ?? "",
            name: values.name,
            minimumStockAlert: values.minimumStockAlert,
            unit: values.unit,
            description: values.description,
          })
        : await createProductAction({
            name: values.name,
            minimumStockAlert: values.minimumStockAlert,
            unit: values.unit,
            description: values.description,
          });

      if (!result.success) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }

      setSubmitError(null);
      toast.success(result.message);
      form.reset(defaultValues);
      router.refresh();
      onSuccess?.();
      createDialog?.close();
    });
  }

  return (
    <form
      className="space-y-5"
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
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="item-name">Item name</Label>
          <Input id="item-name" placeholder="USB Cable" {...form.register("name")} />
          <p className="text-xs text-destructive">{form.formState.errors.name?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-alert">Low stock alert</Label>
          <Input
            id="item-alert"
            type="number"
            min={0}
            {...form.register("minimumStockAlert")}
          />
          <p className="text-xs text-destructive">
            {form.formState.errors.minimumStockAlert?.message}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-unit">Unit</Label>
          <Input id="item-unit" placeholder="pcs" {...form.register("unit")} />
          <p className="text-xs text-destructive">{form.formState.errors.unit?.message}</p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="item-description">Description</Label>
          <Textarea
            id="item-description"
            rows={3}
            placeholder="Optional note about this item"
            {...form.register("description")}
          />
          <p className="text-xs text-destructive">
            {form.formState.errors.description?.message}
          </p>
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : isEdit ? "Save changes" : "Save item"}
        </Button>
      </div>
    </form>
  );
}
