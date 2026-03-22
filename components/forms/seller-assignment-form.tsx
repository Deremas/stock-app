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
import { Textarea } from "@/components/ui/textarea";
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
    sellerId: "",
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
}: SellerAssignmentFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = getDefaultValues(options, initialBatchId);
  const canSubmit = options.branches.length > 0 && options.ownedBatches.length > 0;

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
          <CardTitle>Seller assignment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormFeedback
            errors={form.formState.errors}
            submitError={submitError}
            showValidationSummary={form.formState.submitCount > 0}
          />
          {!canSubmit ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              No owned batches are available to assign in your branches yet.
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="seller-assignment-branch">Branch</Label>
              <Select id="seller-assignment-branch" {...form.register("branchId")}>
                {options.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} - {branch.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="seller-assignment-seller">Seller</Label>
              <Select id="seller-assignment-seller" {...form.register("sellerId")}>
                <option value="">Select seller</option>
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
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="seller-assignment-date">Assignment date</Label>
              <Input
                id="seller-assignment-date"
                type="datetime-local"
                {...form.register("assignmentDate")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seller-assignment-note">Note</Label>
              <Textarea
                id="seller-assignment-note"
                rows={3}
                {...form.register("note")}
              />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Assignment lines
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={getBatchesForBranch(options, branchId).length === 0}
                onClick={() => {
                  const branchBatches = getBatchesForBranch(options, branchId);
                  const nextBatch = branchBatches[0];

                  append({
                    ownedBatchId: nextBatch?.id ?? "",
                    quantityAssigned: 1,
                    sellingPrice: nextBatch?.sellingPrice ?? 0,
                  });
                }}
              >
                <Plus className="h-4 w-4" />
                Add batch
              </Button>
            </div>
            <div className="space-y-4">
              {fields.map((field, index) => {
                const branchBatches = getBatchesForBranch(options, branchId);
                const selectedBatch = branchBatches.find(
                  (batch) => batch.id === items[index]?.ownedBatchId,
                );
                const currentQuantity = Number(items[index]?.quantityAssigned ?? 1);
                const maxQuantity = selectedBatch?.remainingQuantity ?? 0;

                return (
                  <div key={field.id} className="rounded-2xl border border-border p-4">
                    <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_auto]">
                      <div className="space-y-2">
                        <Label>Batch</Label>
                        <Select {...form.register(`items.${index}.ownedBatchId`)}>
                          <option value="">Select available batch</option>
                          {branchBatches.map((batch) => (
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
                        <Label>Qty</Label>
                        <div className="flex items-center rounded-xl border border-border bg-background">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-none rounded-l-xl"
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
                            className="border-0 text-center shadow-none focus-visible:ring-0"
                            {...form.register(`items.${index}.quantityAssigned`)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-none rounded-r-xl"
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
                        <p className="text-xs text-muted-foreground">
                          {maxQuantity > 0
                            ? `Available from batch: ${maxQuantity}`
                            : "No remaining quantity is available in this batch."}
                        </p>
                        <p className="text-xs text-destructive">
                          {form.formState.errors.items?.[index]?.quantityAssigned?.message}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Seller Price / Unit</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          {...form.register(`items.${index}.sellingPrice`)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Defaults from the selected batch and can be adjusted for this assignment.
                        </p>
                        <p className="text-xs text-destructive">
                          {form.formState.errors.items?.[index]?.sellingPrice?.message}
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
                    {selectedBatch ? (
                      <div className="mt-4 grid gap-2 rounded-2xl bg-muted/40 p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                        <p>
                          Item: <span className="font-medium">{selectedBatch.productName}</span>
                        </p>
                        <p>
                          Source:{" "}
                          <span className="font-medium">
                            {selectedBatch.referenceNumber} / {selectedBatch.sourceName}
                          </span>
                        </p>
                        <p>
                          Buying Price:{" "}
                          <span className="font-medium">
                            {formatCurrency(selectedBatch.unitCost)}
                          </span>
                        </p>
                        <p>
                          Current Sell Price:{" "}
                          <span className="font-medium">
                            {formatCurrency(selectedBatch.sellingPrice)}
                          </span>
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Assignment summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            Assigning to a seller moves the quantity out of owned stock and into seller-assigned stock while preserving the source batch cost.
          </div>
          <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            Later sales from seller-assigned stock will keep cost and seller price traceable per assignment line.
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
