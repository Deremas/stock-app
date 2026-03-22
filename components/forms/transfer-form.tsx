"use client";

import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
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
import { createTransferAction } from "@/lib/actions/transfers";
import type { TransferFormOptions } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  transferSchema,
  type TransferFormInput,
} from "@/lib/validation/transfer";

type TransferFormProps = {
  options: TransferFormOptions;
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
    sourceBranchId: sourceBranch?.id ?? "",
    destinationBranchId: destinationBranch?.id ?? "",
    transferAt: new Date().toISOString().slice(0, 16),
    note: "",
    items: [
      {
        productId: defaultProduct?.id ?? "",
        ownedBatchId: defaultBatch?.id ?? "",
        quantity: 1,
      },
    ],
  };
}

export function TransferForm({ options }: TransferFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = getDefaultValues(options);
  const defaultProduct = options.products[0];
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
      const previousProductId = previousLine?.productId;
      const previousOwnedBatchId = previousLine?.ownedBatchId ?? "";
      const productChanged = item.productId !== previousProductId;
      const batchStillValid = availableBatches.some(
        (batch) => batch.id === item.ownedBatchId,
      );

      if (!batchStillValid) {
        form.setValue(`items.${index}.ownedBatchId`, availableBatches[0]?.id ?? "", {
          shouldDirty: true,
        });
      }

      if (!productChanged && !sourceChanged && item.ownedBatchId === previousOwnedBatchId) {
        return;
      }

      if (availableBatches.length > 0 && item.ownedBatchId !== availableBatches[0]?.id) {
        form.setValue(`items.${index}.ownedBatchId`, availableBatches[0]?.id ?? "", {
          shouldDirty: true,
        });
      }
    });

    previousSourceBranchId.current = sourceBranchId;
    previousLineState.current = items.map((item) => ({
      productId: item.productId,
      ownedBatchId: item.ownedBatchId,
    }));
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
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sourceBranchId">Source branch</Label>
              <Select id="sourceBranchId" {...form.register("sourceBranchId")}>
                {options.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} - {branch.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="destinationBranchId">Destination branch</Label>
              <Select id="destinationBranchId" {...form.register("destinationBranchId")}>
                {options.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} - {branch.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-destructive">
                {form.formState.errors.destinationBranchId?.message}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
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
              <Textarea id="transfer-note" rows={3} {...form.register("note")} />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Transfer lines
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={options.products.length === 0}
                onClick={() =>
                  append({
                    productId: defaultProduct?.id ?? "",
                    ownedBatchId:
                      getOwnedBatchesForLine(
                        options,
                        sourceBranchId,
                        defaultProduct?.id,
                      )[0]?.id ?? "",
                    quantity: 1,
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Add item
              </Button>
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
                  <div key={field.id} className="rounded-2xl border border-border p-4">
                    <div className="grid gap-4 lg:grid-cols-[2fr_1.6fr_1fr_auto]">
                      <div className="space-y-2">
                        <Label>Item</Label>
                        <Select {...form.register(`items.${index}.productId`)}>
                          {options.products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Batch</Label>
                        <Select {...form.register(`items.${index}.ownedBatchId`)}>
                          <option value="">Select batch</option>
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
                      <div className="space-y-2">
                        <Label>Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          {...form.register(`items.${index}.quantity`)}
                        />
                        <p className="text-xs text-destructive">
                          {form.formState.errors.items?.[index]?.quantity?.message}
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
                          Source: <span className="font-medium">{selectedBatch.sourceName}</span>
                        </p>
                        <p>
                          Remaining:{" "}
                          <span className="font-medium">{selectedBatch.remainingQuantity}</span>
                        </p>
                        <p>
                          Buying Price:{" "}
                          <span className="font-medium">
                            {formatCurrency(selectedBatch.unitCost)}
                          </span>
                        </p>
                        <p>
                          Selling Price:{" "}
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
          <CardTitle>Transfer summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            Transfer posting immediately moves stock out of the source branch and into the destination branch.
          </div>
          <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            The destination receives a real saleable owned batch with the same buying price and current selling price.
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
              {isPending ? "Saving..." : "Post transfer"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
