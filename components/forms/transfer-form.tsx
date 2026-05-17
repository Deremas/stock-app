"use client";

import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { createTransferAction } from "@/lib/actions/transfers";
import type { TransferFormOptions } from "@/lib/types";
import { formatCurrency, formatDateForInput } from "@/lib/utils";
import {
  transferSchema,
  type TransferFormInput,
} from "@/lib/validation/transfer";

type TransferFormProps = {
  options: TransferFormOptions;
  initialProductId?: string;
  initialSourceBranchId?: string;
};

function getOwnedBatchesForLine(
  options: TransferFormOptions,
  sourceBranchId: string | undefined,
  productId: string | undefined,
) {
  if (!sourceBranchId || !productId) {
    return [];
  }

  return options.ownedBatches.filter(
    (batch) => batch.branchId === sourceBranchId && batch.productId === productId,
  );
}

function getAvailableProductsForBranch(
  options: TransferFormOptions,
  branchId: string | undefined,
) {
  if (!branchId) {
    return [];
  }

  const availableProductIds = new Set(
    options.ownedBatches
      .filter((batch) => batch.branchId === branchId && batch.remainingQuantity > 0)
      .map((batch) => batch.productId),
  );

  return options.products.filter((product) =>
    availableProductIds.has(product.id),
  );
}

function getDefaultValues(options: TransferFormOptions): TransferFormInput {
  const sourceBranch = options.branches[0];
  const destinationBranch =
    options.branches.find((branch) => branch.id !== sourceBranch?.id) ?? options.branches[1];
  const defaultProduct = options.products[0];
  const defaultBatch = getOwnedBatchesForLine(
    options,
    sourceBranch?.id,
    defaultProduct?.id,
  )[0];

  return {
    sourceBranchId: "",
    destinationBranchId: "",
    transferAt: formatDateForInput(),
    note: "",
    items: [
      {
        productId: "",
        ownedBatchId: "",
        quantity: 1,
      },
    ],
  };
}

export function TransferForm({ options, initialProductId, initialSourceBranchId }: TransferFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultProduct = options.products[0];
  
  const defaultValues = useMemo(() => {
    const base = getDefaultValues(options);
    return {
      ...base,
      ...(initialSourceBranchId ? { sourceBranchId: initialSourceBranchId } : {}),
      items: [
        {
          ...base.items[0],
          ...(initialProductId ? { productId: initialProductId } : {}),
        },
      ],
    };
  }, [options, initialProductId, initialSourceBranchId]);

  const canSubmit = options.branches.length > 1 && options.products.length > 0;

  const form = useForm<TransferFormInput>({
    resolver: zodResolver(transferSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const sourceBranchId = form.watch("sourceBranchId");
  const items = form.watch("items");
  const availableProducts = getAvailableProductsForBranch(options, sourceBranchId);
  const previousSourceBranchId = useRef(defaultValues.sourceBranchId);
  const previousLineState = useRef(
    defaultValues.items.map((item) => ({
      productId: item.productId,
      ownedBatchId: item.ownedBatchId,
    })),
  );

  useEffect(() => {
    const sourceChanged = sourceBranchId !== previousSourceBranchId.current;

    items.forEach((item, index) => {
      const previousLine = previousLineState.current[index];
      const availableBatches = getOwnedBatchesForLine(
        options,
        sourceBranchId,
        item.productId,
      );
      const batchStillValid = availableBatches.some(
        (batch) => batch.id === item.ownedBatchId,
      );

      if (!batchStillValid) {
        form.setValue(`items.${index}.ownedBatchId`, "", {
          shouldDirty: true,
        });
      }
    });
  }, [form, items, options, sourceBranchId]);

  function handleCancel() {
    setSubmitError(null);
    form.reset(defaultValues);
    createDialog?.close();
  }

  function onSubmit(values: TransferFormInput) {
    startTransition(async () => {
      setSubmitError(null);
      const result = await createTransferAction(values);

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

  if (options.branches.length < 2) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Assign this user to at least two branches before creating transfers.
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => createDialog?.close()}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-6"
      onChangeCapture={() => {
        if (submitError) {
          setSubmitError(null);
        }
      }}
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <Card>
        <CardHeader>
          <CardTitle>Transfer entry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormFeedback
            errors={form.formState.errors}
            submitError={submitError}
            showValidationSummary={form.formState.submitCount > 0}
          />
          {!canSubmit ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Create active branches and items before posting transfers.
            </div>
          ) : null}
          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sourceBranchId">Source branch</Label>
              <Select id="sourceBranchId" {...form.register("sourceBranchId")}>
                <option value="">Select source branch</option>
                {options.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="destinationBranchId">Destination branch</Label>
              <Select id="destinationBranchId" {...form.register("destinationBranchId")}>
                <option value="">Select destination branch</option>
                {options.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-destructive">
                {form.formState.errors.destinationBranchId?.message}
              </p>
            </div>
          </div>
          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transferAt">Transfer date</Label>
              <Input
                id="transferAt"
                type="datetime-local"
                {...form.register("transferAt")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-note">Note</Label>
              <Textarea id="transfer-note" rows={1} className="min-h-[40px] resize-none" {...form.register("note")} />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Transfer lines
              </h3>
            </div>
            <div className="space-y-4">
              {fields.map((field, index) => {
                const lineBatches = getOwnedBatchesForLine(
                  options,
                  sourceBranchId,
                  items[index]?.productId,
                );
                const selectedBatch = lineBatches.find(
                  (batch) => batch.id === items[index]?.ownedBatchId,
                );

                return (
                  <div key={field.id} className="relative rounded-2xl border border-border p-4">
                    {index > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => remove(index)}
                        title="Remove line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <div className="grid gap-4 sm:grid-cols-[2fr_1.5fr_100px] sm:items-start">
                      <div className="space-y-2">
                        <Label>Item</Label>
                        <Select 
                          {...form.register(`items.${index}.productId`, {
                            onChange: () => {
                              form.setValue(`items.${index}.ownedBatchId`, "", { shouldDirty: true });
                            }
                          })}
                        >
                          <option value="">Select item</option>
                          {availableProducts.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="flex gap-2 sm:contents">
                        <div className="min-w-0 flex-1 space-y-2">
                          <Label>Source</Label>
                          <Select {...form.register(`items.${index}.ownedBatchId`)}>
                            <option value="">Select item source</option>
                            {lineBatches.map((batch) => (
                              <option key={batch.id} value={batch.id}>
                                {batch.referenceNumber} | {batch.remainingQuantity} left
                              </option>
                            ))}
                          </Select>
                          <p className="text-xs text-destructive">
                            {form.formState.errors.items?.[index]?.ownedBatchId?.message}
                          </p>
                        </div>
                        <div className="w-[72px] shrink-0 space-y-2">
                        <Label>
                          Qty{" "}
                          {selectedBatch && (
                            <span className="text-[10px] text-muted-foreground">
                              (Max: {selectedBatch.remainingQuantity})
                            </span>
                          )}
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          max={selectedBatch?.remainingQuantity}
                          {...form.register(`items.${index}.quantity`)}
                        />
                        <p className="text-xs text-destructive">
                          {form.formState.errors.items?.[index]?.quantity?.message}
                        </p>
                      </div>
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
                disabled={options.products.length === 0}
                onClick={() =>
                  append({
                    productId: defaultProduct?.id ?? "",
                    ownedBatchId: "",
                    quantity: 1,
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Add item
              </Button>
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !canSubmit}>
              {isPending ? "Saving..." : "Post transfer"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
