"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createSellerIntakeAction } from "@/lib/actions/sellers";
import type { SellerIntakeFormOptions } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  sellerIntakeSchema,
  type SellerIntakeFormInput,
} from "@/lib/validation/seller";

type SellerIntakeFormProps = {
  options: SellerIntakeFormOptions;
  mode?: "page" | "modal";
  cancelHref?: Route;
  onCancel?: () => void;
  onSuccess?: () => void;
};

function getDefaultValues(options: SellerIntakeFormOptions): SellerIntakeFormInput {
  return {
    branchId: options.branches[0]?.id ?? "",
    sellerId: options.sellers[0]?.id ?? "",
    bringingDate: new Date().toISOString().slice(0, 16),
    note: "",
    items: [
      {
        itemName: "",
        quantityBrought: 1,
        sellerFixedPrice: 0,
      },
    ],
  };
}

export function SellerIntakeForm({
  options,
  mode = "page",
  cancelHref,
  onCancel,
  onSuccess,
}: SellerIntakeFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = getDefaultValues(options);
  const canSubmit = options.branches.length > 0 && options.sellers.length > 0;

  const form = useForm<SellerIntakeFormInput>({
    resolver: zodResolver(sellerIntakeSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const items = form.watch("items");
  const payable = items.reduce((sum, item) => {
    return sum + Number(item.quantityBrought || 0) * Number(item.sellerFixedPrice || 0);
  }, 0);

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

  function onSubmit(values: SellerIntakeFormInput) {
    startTransition(async () => {
      setSubmitError(null);
      const result = await createSellerIntakeAction(values);

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
      className="grid gap-6 xl:grid-cols-[2fr_1fr]"
      onChangeCapture={() => {
        if (submitError) {
          setSubmitError(null);
        }
      }}
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <Card>
        <CardHeader>
          <CardTitle>Received from partner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormFeedback
            errors={form.formState.errors}
            submitError={submitError}
            showValidationSummary={form.formState.submitCount > 0}
          />
          {!canSubmit ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Create active branches and partners before recording received items.
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="intake-branch">Branch</Label>
              <Select id="intake-branch" {...form.register("branchId")}>
                {options.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} - {branch.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellerId">Partner</Label>
              <Select id="sellerId" {...form.register("sellerId")}>
                {options.sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bringingDate">Bringing date</Label>
              <Input id="bringingDate" type="datetime-local" {...form.register("bringingDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="intake-note">Note</Label>
              <Textarea id="intake-note" rows={3} {...form.register("note")} />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Received items
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    itemName: "",
                    quantityBrought: 1,
                    sellerFixedPrice: 0,
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Add item
              </Button>
            </div>
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="rounded-2xl border border-border p-4">
                  <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_auto]">
                    <div className="space-y-2">
                      <Label>Item name</Label>
                      <Input
                        placeholder="Type item name"
                        {...form.register(`items.${index}.itemName`)}
                      />
                      <p className="text-xs text-destructive">
                        {form.formState.errors.items?.[index]?.itemName?.message}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Qty</Label>
                      <Input
                        type="number"
                        min={1}
                        {...form.register(`items.${index}.quantityBrought`)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Price got</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        {...form.register(`items.${index}.sellerFixedPrice`)}
                      />
                      <p className="text-xs text-destructive">
                        {form.formState.errors.items?.[index]?.sellerFixedPrice?.message}
                      </p>
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Partner payable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Total payable if all received items sell</p>
            <p className="mt-2 text-3xl font-semibold">{formatCurrency(payable)}</p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="sm:flex-1"
              disabled={isPending}
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button className="sm:flex-1" type="submit" disabled={isPending || !canSubmit}>
              {isPending ? "Saving..." : "Save intake"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
