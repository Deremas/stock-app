"use client";

import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createSellerAssignmentAction } from "@/lib/actions/seller-assignments";
import type { SellerAssignmentFormOptions } from "@/lib/types";
import { formatCurrency, formatDateForInput } from "@/lib/utils";
import {
  sellerAssignmentSchema,
  type SellerAssignmentFormInput,
} from "@/lib/validation/seller-assignment";

type SellerAssignmentFormProps = {
  options: SellerAssignmentFormOptions;
  userRole?: string;
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
    sellerId: initialSellerId ?? options.sellers[0]?.id ?? "",
    assignmentDate: formatDateForInput(),
    note: "",
    items: [
      {
        ownedBatchId: initialBatchId ?? "",
        quantityAssigned: 1,
        sellingPrice: initialBatchId ? (seededBatch?.sellingPrice ?? 0) : 0,
      },
    ],
  };
}

export function SellerAssignmentForm({
  options,
  userRole,
  initialBatchId,
  initialSellerId,
}: SellerAssignmentFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    title: string;
    message: string;
    nextSteps: { label: string; href: string }[];
  } | null>(null);
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
    const branchBatches = getBatchesForBranch(options, branchId);

    items.forEach((item, index) => {
      const batchStillValid = item.ownedBatchId === "" || branchBatches.some((batch) => batch.id === item.ownedBatchId);
      if (!batchStillValid) {
        form.setValue(`items.${index}.ownedBatchId`, "", { shouldDirty: true });
        form.setValue(`items.${index}.sellingPrice`, 0, { shouldDirty: true });
      }
    });
  }, [branchId, form, items, options]);

  function handleCancel() {
    setSubmitError(null);
    setSuccess(null);
    form.reset(defaultValues);
    createDialog?.close();
  }

  function onSubmit(values: SellerAssignmentFormInput) {
    startTransition(async () => {
      setSubmitError(null);
      setSuccess(null);
      const result = await createSellerAssignmentAction(values);

      if (!result.success) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }

      setSubmitError(null);
      setSuccess({
        title: "Assignment Successful",
        message: `Successfully assigned ${totalAssignedQuantity} unit(s) to the seller. What would you like to do next?`,
        nextSteps: [
          { label: "Assign More", href: "/sellers/assign-items?open=1" },
          { label: "Go to Dashboard", href: "/dashboard" },
        ],
      });
      toast.success(result.message);
      form.reset(defaultValues);
      router.refresh();
    });
  }

  function handleAppendItem() {
    append({
      ownedBatchId: "",
      quantityAssigned: 1,
      sellingPrice: 0,
    });
  }

  return (
    <form
      className="grid gap-3 sm:gap-6 xl:grid-cols-[2fr_1fr]"
      onChangeCapture={() => {
        if (submitError) setSubmitError(null);
        if (success) setSuccess(null);
      }}
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Seller assignment</CardTitle>
            {!canSubmit ? (
              <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                Need branch, seller, and available stock.
              </p>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 sm:space-y-6 sm:p-6 sm:pt-0">
          <FormFeedback
            errors={form.formState.errors}
            submitError={submitError}
            success={success}
            showValidationSummary={form.formState.submitCount > 0}
          />
          {success ? null : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                {userRole === "ADMIN" || options.branches.length > 1 ? (
                  <div className="space-y-2">
                    <Label htmlFor="seller-assignment-branch">Branch</Label>
                    <Select id="seller-assignment-branch" {...form.register("branchId")}>
                      <option value="">Select branch</option>
                      {options.branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Branch</Label>
                    <div className="flex h-10 w-full items-center rounded-xl border border-input bg-muted px-3 py-2 text-sm text-muted-foreground ring-offset-background">
                      {options.branches.find((b) => b.id === branchId)?.name ?? "Active Branch"}
                    </div>
                    <input type="hidden" {...form.register("branchId")} />
                  </div>
                )}
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seller-assignment-date">Assignment date</Label>
                  <Input
                    id="seller-assignment-date"
                    type="datetime-local"
                    {...form.register("assignmentDate")}
                  />
                </div>
              </div>
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Items to assign
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
                          {index > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => remove(index)}
                              title="Remove line"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-[minmax(0,2.5fr)_minmax(108px,0.9fr)_minmax(132px,1fr)]">
                          <div className="col-span-2 space-y-2 md:col-span-1">
                            <Label className="text-xs font-medium sm:text-sm">Item</Label>
                            <Select 
                              {...form.register(`items.${index}.ownedBatchId`, {
                                onChange: (e) => {
                                  const batchId = e.target.value;
                                  const batch = options.ownedBatches.find((b) => b.id === batchId);
                                  if (batch) {
                                    form.setValue(`items.${index}.sellingPrice`, batch.sellingPrice, {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    });
                                  } else {
                                    form.setValue(`items.${index}.sellingPrice`, 0, {
                                      shouldDirty: true,
                                    });
                                  }
                                }
                              })}
                            >
                              <option value="">Select item</option>
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
                                ? `${maxQuantity} available.`
                                : "No quantity left for this item."}
                            </p>
                            <p className="text-xs text-destructive">
                              {form.formState.errors.items?.[index]?.quantityAssigned?.message}
                            </p>
                          </div>
                          <div className="col-span-1 space-y-2 md:col-span-1">
                            <Label className="text-xs font-medium sm:text-sm">Selling price</Label>
                            <Controller
                              name={`items.${index}.sellingPrice`}
                              control={form.control}
                              render={({ field }) => (
                                <CurrencyInput
                                  value={
                                    typeof field.value === "string" ||
                                    typeof field.value === "number"
                                      ? field.value
                                      : null
                                  }
                                  onValueChange={(val) => field.onChange(val)}
                                />
                              )}
                            />
                            <p className="text-xs text-destructive">
                              {form.formState.errors.items?.[index]?.sellingPrice?.message}
                            </p>
                          </div>
                        </div>
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
                    Add item
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      {success ? null : (
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
            {/* Summary description removed for simplicity */}
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
      )}
    </form>
  );
}
