"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { FormFeedback } from "@/components/forms/form-feedback";
import { PartnerForm } from "@/components/forms/partner-form";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
  initialSellerId?: string;
};

function getDefaultValues(
  options: SellerIntakeFormOptions,
  initialSellerId?: string,
): SellerIntakeFormInput {
  const defaultSeller =
    options.sellers.find((seller) => seller.id === initialSellerId) ?? options.sellers[0];

  return {
    branchId: options.branches[0]?.id ?? "",
    sellerId: defaultSeller?.id ?? "",
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
  initialSellerId,
}: SellerIntakeFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sellerOptions, setSellerOptions] = useState(options.sellers);
  const [isPartnerDialogOpen, setPartnerDialogOpen] = useState(false);
  const defaultValues = getDefaultValues(
    { ...options, sellers: sellerOptions },
    initialSellerId,
  );
  const hasBranches = options.branches.length > 0;
  const hasSellers = sellerOptions.length > 0;
  const canSubmit = hasBranches && hasSellers;

  const form = useForm<SellerIntakeFormInput>({
    resolver: zodResolver(sellerIntakeSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const sellerId = form.watch("sellerId");
  const items = form.watch("items");
  const totalReceivedQuantity = items.reduce(
    (sum, item) => sum + Number(item.quantityBrought || 0),
    0,
  );
  const payable = items.reduce((sum, item) => {
    return sum + Number(item.quantityBrought || 0) * Number(item.sellerFixedPrice || 0);
  }, 0);

  useEffect(() => {
    if (sellerOptions.length === 0) {
      if (sellerId) {
        form.setValue("sellerId", "", {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      return;
    }

    if (!sellerOptions.some((seller) => seller.id === sellerId)) {
      form.setValue("sellerId", sellerOptions[0]?.id ?? "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, sellerId, sellerOptions]);

  function getResetValues() {
    return {
      ...getDefaultValues({ ...options, sellers: sellerOptions }, initialSellerId),
      branchId: form.getValues("branchId") || defaultValues.branchId,
      sellerId:
        form.getValues("sellerId") ||
        sellerOptions.find((seller) => seller.id === initialSellerId)?.id ||
        sellerOptions[0]?.id ||
        "",
    } satisfies SellerIntakeFormInput;
  }

  function handleCancel() {
    setSubmitError(null);
    form.reset(getResetValues());

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
      form.reset(getResetValues());
      router.refresh();
      onSuccess?.();
      createDialog?.close();
    });
  }

  function handleAppendItem() {
    append({
      itemName: "",
      quantityBrought: 1,
      sellerFixedPrice: 0,
    });
  }

  return (
    <>
      <form
        className="grid gap-3 sm:gap-6 xl:grid-cols-[2fr_1fr]"
        onChangeCapture={() => {
          if (submitError) {
            setSubmitError(null);
          }
        }}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Received from partner</CardTitle>
              {!canSubmit ? (
                <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                  Need branch and partner.
                </p>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:space-y-6 sm:p-6 sm:pt-0">
            <FormFeedback
              errors={form.formState.errors}
              submitError={submitError}
              showValidationSummary={form.formState.submitCount > 0}
            />
            {!hasBranches ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4">
                Create active branches and partners before recording received items.
              </div>
            ) : !hasSellers ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4">
                Create an active partner before recording received items.
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="intake-branch">Branch</Label>
                <Select id="intake-branch" {...form.register("branchId")}>
                  {options.branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} - {branch.name}
                    </option>
                  ))}
                </Select>
                {form.formState.errors.branchId?.message ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.branchId.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="sellerId">Partner</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-primary"
                    onClick={() => setPartnerDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add partner
                  </Button>
                </div>
                <Select id="sellerId" {...form.register("sellerId")}>
                  <option value="">Select partner</option>
                  {sellerOptions.map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.name}
                    </option>
                  ))}
                </Select>
                {form.formState.errors.sellerId?.message ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.sellerId.message}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid gap-3">
              <div className="w-full max-w-[18rem] space-y-2 sm:max-w-[19rem]">
                <Label htmlFor="bringingDate">Bringing date</Label>
                <Input
                  id="bringingDate"
                  type="datetime-local"
                  {...form.register("bringingDate")}
                />
                {form.formState.errors.bringingDate?.message ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.bringingDate.message}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Received items
                </h3>
              </div>
              <div className="space-y-2.5 sm:space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-3 dark:border-primary/20 dark:bg-primary/[0.08] sm:p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/85">
                        Line {index + 1}
                      </p>
                      {fields.length > 1 && index > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={`Remove line ${index + 1}`}
                          className="h-8 w-8 shrink-0 rounded-lg border-destructive/35 bg-background/80 text-destructive shadow-sm hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(96px,0.8fr)_minmax(132px,1fr)]">
                      <div className="col-span-2 space-y-2 lg:col-span-1">
                        <Label className="text-xs font-medium sm:text-sm">Item name</Label>
                        <Input
                          placeholder="Type item name"
                          {...form.register(`items.${index}.itemName`)}
                        />
                        <p className="text-xs text-destructive">
                          {form.formState.errors.items?.[index]?.itemName?.message}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium sm:text-sm">Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          {...form.register(`items.${index}.quantityBrought`)}
                        />
                        <p className="text-xs text-destructive">
                          {form.formState.errors.items?.[index]?.quantityBrought?.message}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium sm:text-sm">Price got</Label>
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
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={handleAppendItem}>
                  <Plus className="h-4 w-4" />
                  Add item
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Partner payable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:space-y-4 sm:p-6 sm:pt-0">
            <div className="rounded-2xl bg-muted/60 p-3 sm:p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Items</p>
                  <p className="mt-1 text-2xl font-semibold">{fields.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total qty</p>
                  <p className="mt-1 text-2xl font-semibold">{totalReceivedQuantity}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-muted/60 p-3 sm:p-4">
              <p className="text-sm text-muted-foreground">
                Total payable if all received items sell
              </p>
              <p className="mt-2 text-3xl font-semibold">{formatCurrency(payable)}</p>
            </div>
            <div className="rounded-2xl bg-muted/60 p-3 text-sm text-muted-foreground sm:p-4">
              Received partner items stay payable only when sold. Unsold quantity can be returned back to the partner from the returns screen.
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
      <Dialog open={isPartnerDialogOpen} onOpenChange={setPartnerDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add partner</DialogTitle>
            <DialogDescription>
              Create a partner without leaving the received-stock screen.
            </DialogDescription>
          </DialogHeader>
          <PartnerForm
            submitLabel="Save partner"
            refreshAfterSuccess={false}
            onCancel={() => setPartnerDialogOpen(false)}
            onSuccess={(partner) => {
              setSellerOptions((current) =>
                [...current, partner].sort((left, right) =>
                  left.name.localeCompare(right.name),
                ),
              );
              form.setValue("sellerId", partner.id, {
                shouldDirty: true,
                shouldValidate: true,
              });
              setPartnerDialogOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
