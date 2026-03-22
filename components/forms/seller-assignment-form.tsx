"use client";

import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
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
import { createSellerAssignmentAction } from "@/lib/actions/seller-assignments";
import type { SellerAssignmentFormOptions } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  sellerAssignmentSchema,
  type SellerAssignmentFormInput,
} from "@/lib/validation/seller-assignment";

type SellerAssignmentFormProps = {
  options: SellerAssignmentFormOptions;
  initialBatchId?: string;
  initialSellerId?: string;
};

function getBatchesForBranch(
  options: SellerAssignmentFormOptions,
  branchId: string | undefined,
) {
  if (!branchId) {
    return [];
  }

  return options.ownedBatches.filter((batch) => batch.branchId === branchId);
}

function getDefaultValues(
  options: SellerAssignmentFormOptions,
  initialBatchId?: string,
  initialSellerId?: string,
): SellerAssignmentFormInput {
  const seededBatch = options.ownedBatches.find((batch) => batch.id === initialBatchId);
  const selectedBranch =
    options.branches.find((branch) => branch.id === seededBatch?.branchId) ??
    options.branches[0];
  const branchBatches = getBatchesForBranch(options, selectedBranch?.id);
  const defaultBatch =
    branchBatches.find((batch) => batch.id === initialBatchId) ?? branchBatches[0];

  return {
    branchId: selectedBranch?.id ?? "",
    sellerId:
      options.sellers.find((seller) => seller.id === initialSellerId)?.id ?? "",
    assignmentDate: new Date().toISOString().slice(0, 16),
    note: "",
    items: [
      {
        ownedBatchId: defaultBatch?.id ?? "",
        quantityAssigned: 1,
        sellingPrice: defaultBatch?.sellingPrice ?? 0,
      },
    ],
  };
}

export function SellerAssignmentForm({
  options,
  initialBatchId,
  initialSellerId,
}: SellerAssignmentFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = getDefaultValues(options, initialBatchId, initialSellerId);
  const hasBranches = options.branches.length > 0;
  const hasOwnedBatches = options.ownedBatches.length > 0;
  const hasSellers = options.sellers.length > 0;
  const canSubmit = hasBranches && hasOwnedBatches && hasSellers;

  const form = useForm<SellerAssignmentFormInput>({
    resolver: zodResolver(sellerAssignmentSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const branchId = form.watch("branchId");
  const items = form.watch("items");
  const availableBranchBatches = getBatchesForBranch(options, branchId);
  const totalAssignedQuantity = items.reduce(
    (sum, item) => sum + Number(item.quantityAssigned || 0),
    0,
  );
  const projectedSellerValue = items.reduce(
    (sum, item) =>
      sum + Number(item.quantityAssigned || 0) * Number(item.sellingPrice || 0),
    0,
  );
  const previousBranchId = useRef(defaultValues.branchId);
  const previousBatchIds = useRef(defaultValues.items.map((item) => item.ownedBatchId));

  useEffect(() => {
    const branchChanged = branchId !== previousBranchId.current;
    const branchBatches = getBatchesForBranch(options, branchId);
    const fallbackBatch = branchBatches[0];

    items.forEach((item, index) => {
      const previousBatchId = previousBatchIds.current[index] ?? "";
      const batchChanged = item.ownedBatchId !== previousBatchId;
      const batchStillValid = branchBatches.some((batch) => batch.id === item.ownedBatchId);
      const nextBatchId = batchStillValid ? item.ownedBatchId : fallbackBatch?.id ?? "";
      const selectedBatch = branchBatches.find((batch) => batch.id === nextBatchId);

      if (!batchStillValid && item.ownedBatchId !== nextBatchId) {
        form.setValue(`items.${index}.ownedBatchId`, nextBatchId, {
          shouldDirty: true,
        });
      }

      if (!branchChanged && !batchChanged && item.ownedBatchId === nextBatchId) {
        return;
      }

      form.setValue(`items.${index}.sellingPrice`, selectedBatch?.sellingPrice ?? 0, {
        shouldDirty: true,
      });
    });

    previousBranchId.current = branchId;
    previousBatchIds.current = items.map((item) => item.ownedBatchId);
  }, [branchId, form, items, options]);

  function handleCancel() {
    setSubmitError(null);
    form.reset(defaultValues);
    createDialog?.close();
  }

  function onSubmit(values: SellerAssignmentFormInput) {
    startTransition(async () => {
      setSubmitError(null);
      const result = await createSellerAssignmentAction(values);

      if (!result.success) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }

      setSubmitError(null);
      toast.success(result.message);
      form.reset(defaultValues);
      router.refresh();
      createDialog?.close();
    });
  }

  function handleAppendItem() {
    const nextBatch = availableBranchBatches[0];

    append({
      ownedBatchId: nextBatch?.id ?? "",
      quantityAssigned: 1,
      sellingPrice: nextBatch?.sellingPrice ?? 0,
    });
  }

  return (
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
            <CardTitle>Partner assignment</CardTitle>
            {!canSubmit ? (
              <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                Need branch, partner, and available stock.
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
          {!hasOwnedBatches ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4">
              No owned batches are available to assign in your branches yet.
            </div>
          ) : !hasSellers ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4">
              Add a partner first before posting an assignment.
            </div>
          ) : !hasBranches ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4">
              Add a branch first before posting an assignment.
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="seller-assignment-branch">Branch</Label>
              <Select id="seller-assignment-branch" {...form.register("branchId")}>
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
              <Label htmlFor="seller-assignment-seller">Partner</Label>
              <Select id="seller-assignment-seller" {...form.register("sellerId")}>
                <option value="">Select partner</option>
                {options.sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-destructive">
                {form.formState.errors.sellerId?.message}
              </p>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="w-full max-w-[18rem] space-y-2 sm:max-w-[19rem]">
              <Label htmlFor="seller-assignment-date">Assignment date</Label>
              <Input
                id="seller-assignment-date"
                type="datetime-local"
                {...form.register("assignmentDate")}
              />
              {form.formState.errors.assignmentDate?.message ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.assignmentDate.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Assignment lines
              </h3>
            </div>
            <div className="space-y-2.5 sm:space-y-4">
              {fields.map((field, index) => {
                const selectedBatch = availableBranchBatches.find(
                  (batch) => batch.id === items[index]?.ownedBatchId,
                );
                const currentQuantity = Number(items[index]?.quantityAssigned ?? 1);
                const maxQuantity = selectedBatch?.remainingQuantity ?? 0;

                return (
                  <div
                    key={field.id}
                    className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-3 dark:border-primary/20 dark:bg-primary/[0.08] sm:p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/85">
                        Line {index + 1}
                      </p>
                      {fields.length > 1 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 rounded-lg border-destructive/35 bg-background/80 px-2.5 text-destructive shadow-sm hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,2.8fr)_minmax(108px,0.9fr)_minmax(144px,1fr)] lg:items-start">
                      <div className="col-span-2 space-y-2 lg:col-span-1">
                        <Label className="text-xs font-medium sm:text-sm">Batch</Label>
                        <Select {...form.register(`items.${index}.ownedBatchId`)}>
                          <option value="">Select available batch</option>
                          {availableBranchBatches.map((batch) => (
                            <option key={batch.id} value={batch.id}>
                              {batch.productName} | {batch.referenceNumber} | {batch.remainingQuantity} left
                            </option>
                          ))}
                        </Select>
                        <p className="text-xs text-destructive">
                          {form.formState.errors.items?.[index]?.ownedBatchId?.message}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium sm:text-sm">Qty</Label>
                        <div className="flex items-center rounded-xl border border-border bg-background">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-none rounded-l-xl sm:h-10 sm:w-10"
                            disabled={currentQuantity <= 1}
                            onClick={() =>
                              form.setValue(
                                `items.${index}.quantityAssigned`,
                                Math.max(1, currentQuantity - 1),
                                { shouldDirty: true },
                              )
                            }
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            max={maxQuantity || undefined}
                            className="h-9 border-0 px-1 text-center shadow-none focus-visible:ring-0 sm:h-10"
                            {...form.register(`items.${index}.quantityAssigned`)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-none rounded-r-xl sm:h-10 sm:w-10"
                            disabled={maxQuantity > 0 ? currentQuantity >= maxQuantity : false}
                            onClick={() =>
                              form.setValue(
                                `items.${index}.quantityAssigned`,
                                currentQuantity + 1,
                                { shouldDirty: true },
                              )
                            }
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground sm:text-xs">
                          {maxQuantity > 0
                            ? `${maxQuantity} available in this batch.`
                            : "No quantity is left in this batch."}
                        </p>
                        <p className="text-xs text-destructive">
                          {form.formState.errors.items?.[index]?.quantityAssigned?.message}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium sm:text-sm">
                          Partner Pays / Unit
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          {...form.register(`items.${index}.sellingPrice`)}
                        />
                        <p className="text-[11px] text-muted-foreground sm:text-xs">
                          Use the amount the partner should remit for each sold unit from this assignment.
                        </p>
                        <p className="text-xs text-destructive">
                          {form.formState.errors.items?.[index]?.sellingPrice?.message}
                        </p>
                      </div>
                    </div>
                    {selectedBatch ? (
                      <div className="mt-3 grid gap-2 rounded-2xl bg-background/80 p-3 text-[11px] text-muted-foreground sm:text-xs md:grid-cols-2 xl:grid-cols-4">
                        <p>
                          Item:{" "}
                          <span className="font-medium text-foreground">
                            {selectedBatch.productName}
                          </span>
                        </p>
                        <p>
                          Source:{" "}
                          <span className="font-medium text-foreground">
                            {selectedBatch.referenceNumber} / {selectedBatch.sourceName}
                          </span>
                        </p>
                        <p>
                          Buying Price:{" "}
                          <span className="font-medium text-foreground">
                            {formatCurrency(selectedBatch.unitCost)}
                          </span>
                        </p>
                        <p>
                          Current Sell Price:{" "}
                          <span className="font-medium text-foreground">
                            {formatCurrency(selectedBatch.sellingPrice)}
                          </span>
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={availableBranchBatches.length === 0}
                onClick={handleAppendItem}
              >
                <Plus className="h-4 w-4" />
                Add batch
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle>Assignment summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:space-y-4 sm:p-6 sm:pt-0">
          <div className="rounded-2xl bg-muted/60 p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Lines</p>
                <p className="mt-1 text-2xl font-semibold">{fields.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Units</p>
                <p className="mt-1 text-2xl font-semibold">{totalAssignedQuantity}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Collection value</p>
                <p className="mt-1 text-xl font-semibold">
                  {formatCurrency(projectedSellerValue)}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-muted/60 p-3 text-sm text-muted-foreground sm:p-4">
            Assigning stock moves quantity from owned inventory to the partner. Sold quantity is tracked per line, and unsold quantity can be returned back into branch stock later.
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
              {isPending ? "Saving..." : "Post assignment"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
