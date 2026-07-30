"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
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
import { createSellerCollectionAction } from "@/lib/actions/seller-collections";
import { formatFinanceAccountLabel } from "@/lib/finance-account-utils";
import type { SellerCollectionFormOptions } from "@/lib/types";
import { formatCurrency, formatDateTime, formatDateForInput } from "@/lib/utils";
import {
  sellerCollectionSchema,
  type SellerCollectionFormInput,
  type SellerCollectionInput,
} from "@/lib/validation/seller-collection";

type SellerCollectionFormProps = {
  options: SellerCollectionFormOptions;
  initialSellerId?: string;
};

function getLinesForSeller(
  options: SellerCollectionFormOptions,
  sellerId: string | undefined,
) {
  return options.lines.filter((line) => !sellerId || line.sellerId === sellerId);
}

function getDefaultValues(
  options: SellerCollectionFormOptions,
  initialSellerId?: string,
): SellerCollectionFormInput {
  const seededLine =
    options.lines.find((line) => line.sellerId === initialSellerId) ?? options.lines[0];
  const sellerId = seededLine?.sellerId ?? "";
  const sellerLines = getLinesForSeller(options, sellerId);
  const firstLine = sellerLines[0] ?? seededLine;

  return {
    sellerId,
    branchId: firstLine?.branchId ?? "",
    financeAccountId: "",
    collectionDate: formatDateForInput(),
    note: "",
    items: [
      {
        lineId: firstLine?.id ?? "",
        amount: firstLine?.amountDue ?? 0,
      },
    ],
  };
}

export function SellerCollectionForm({
  options,
  initialSellerId,
}: SellerCollectionFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = getDefaultValues(options, initialSellerId);
  const hasCollectibleLines = options.lines.length > 0;

  const form = useForm<SellerCollectionFormInput, undefined, SellerCollectionInput>({
    resolver: zodResolver(sellerCollectionSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const sellerId = form.watch("sellerId");
  const branchId = form.watch("branchId");
  const items = form.watch("items");
  const availableLines = useMemo(
    () => getLinesForSeller(options, sellerId),
    [options, sellerId],
  );
  const availableAccounts = useMemo(
    () =>
      options.accounts.filter(
        (account) => !branchId || !account.branchId || account.branchId === branchId,
      ),
    [branchId, options.accounts],
  );
  const branchName = availableLines[0]?.branchName ?? "No branch selected";
  const totalAmount = Number(
    items.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2),
  );
  const totalQuantity = items.reduce((sum, item) => {
    const selectedLine = options.lines.find((line) => line.id === item.lineId);
    return sum + (selectedLine?.quantity ?? 0);
  }, 0);
  const uniqueSales = new Set(
    items
      .map((item) => options.lines.find((line) => line.id === item.lineId)?.saleNumber)
      .filter((saleNumber): saleNumber is string => Boolean(saleNumber)),
  );
  const canAppendLine =
    availableLines.filter(
      (line) => !items.some((currentItem) => currentItem.lineId === line.id),
    ).length > 0;

  useEffect(() => {
    if (options.sellers.length === 0) {
      return;
    }

    if (!options.sellers.some((seller) => seller.id === sellerId)) {
      form.setValue("sellerId", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, options.sellers, sellerId]);

  useEffect(() => {
    const nextBranchId = availableLines[0]?.branchId ?? "";

    if (branchId !== nextBranchId) {
      form.setValue("branchId", nextBranchId, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [availableLines, branchId, form]);

  useEffect(() => {
    const financeAccountId = form.getValues("financeAccountId");

    if (!availableAccounts.some((account) => account.id === financeAccountId)) {
      form.setValue("financeAccountId", availableAccounts[0]?.id ?? "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [availableAccounts, form]);

  useEffect(() => {
    const selectedLineIds = items.map((item) => item.lineId);

    items.forEach((item, index) => {
      const currentLine = availableLines.find((line) => line.id === item.lineId);
      const fallbackLine =
        availableLines.find(
          (line) =>
            !selectedLineIds.some(
              (lineId, currentIndex) => currentIndex !== index && lineId === line.id,
            ),
        ) ?? currentLine ?? availableLines[0];
      const nextLine = currentLine ?? fallbackLine;
      const nextLineId = nextLine?.id ?? "";

      if (item.lineId !== nextLineId) {
        form.setValue(`items.${index}.lineId`, nextLineId, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      const maxAmount = Number((nextLine?.amountDue ?? 0).toFixed(2));
      const currentAmount = Number(item.amount || 0);
      const normalizedAmount =
        maxAmount <= 0
          ? 0
          : currentAmount <= 0 || currentAmount > maxAmount
            ? maxAmount
            : Number(currentAmount.toFixed(2));

      if (currentAmount !== normalizedAmount) {
        form.setValue(`items.${index}.amount`, normalizedAmount, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    });
  }, [availableLines, form, items]);

  function handleCancel() {
    setSubmitError(null);
    form.reset(getDefaultValues(options, initialSellerId));
    createDialog?.close();
  }

  function handleAppendItem() {
    const usedLineIds = new Set(items.map((item) => item.lineId));
    const nextLine = availableLines.find((line) => !usedLineIds.has(line.id));

    if (!nextLine) {
      return;
    }

    append({
      lineId: nextLine.id,
      amount: nextLine.amountDue,
    });
  }

  function onSubmit(values: SellerCollectionInput) {
    startTransition(async () => {
      setSubmitError(null);
      const result = await createSellerCollectionAction(values);

      if (!result.success) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }

      setSubmitError(null);
      toast.success(result.message);
      form.reset(getDefaultValues(options, initialSellerId));
      router.refresh();
      createDialog?.close();
    });
  }

  if (!hasCollectibleLines) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          There are no sold assigned lines waiting for collection right now.
        </p>
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
      className="grid gap-3 sm:gap-6 xl:grid-cols-[2fr_1fr]"
      onChangeCapture={() => {
        if (submitError) {
          setSubmitError(null);
        }
      }}
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <input type="hidden" {...form.register("branchId")} />
      <input type="hidden" {...form.register("note")} />
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle>Collect sold assigned items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 sm:space-y-6 sm:p-6 sm:pt-0">
          <FormFeedback
            errors={form.formState.errors}
            submitError={submitError}
            showValidationSummary={form.formState.submitCount > 0}
          />
          {/* Selection instructions removed for simplicity */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="seller-collection-seller">Seller</Label>
              <Select id="seller-collection-seller" {...form.register("sellerId")}>
                <option value="">Select seller</option>
                {options.sellers.map((seller) => (
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
            <div className="space-y-2">
              <Label htmlFor="seller-collection-account">Receiving account</Label>
              <Select id="seller-collection-account" {...form.register("financeAccountId")}>
                {availableAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {formatFinanceAccountLabel(account)}
                  </option>
                ))}
              </Select>
              {form.formState.errors.financeAccountId?.message ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.financeAccountId.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.7fr)]">
            <div className="rounded-2xl bg-muted/55 p-3 sm:p-4">
              <p className="text-xs text-muted-foreground">Branch</p>
              <p className="mt-1 text-lg font-semibold">{branchName}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="seller-collection-date">Collection date</Label>
              <Input
                id="seller-collection-date"
                type="datetime-local"
                {...form.register("collectionDate")}
              />
              {form.formState.errors.collectionDate?.message ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.collectionDate.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Sold lines
              </h3>
            </div>
            <div className="space-y-2.5 sm:space-y-4">
              {fields.map((field, index) => {
                const selectedLine = options.lines.find((line) => line.id === items[index]?.lineId);
                const usedLineIds = new Set(
                  items
                    .map((item, currentIndex) =>
                      currentIndex === index ? null : item.lineId,
                    )
                    .filter((lineId): lineId is string => Boolean(lineId)),
                );
                const selectableLines = availableLines.filter(
                  (line) => !usedLineIds.has(line.id) || line.id === items[index]?.lineId,
                );

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
                    <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(130px,1fr)]">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium sm:text-sm">Sold line</Label>
                        <Select {...form.register(`items.${index}.lineId`)}>
                          <option value="">Select sold line</option>
                          {selectableLines.map((line) => (
                            <option key={line.id} value={line.id}>
                              {line.productName} | {line.saleNumber} | {line.quantity} sold |{" "}
                              {formatCurrency(line.amountDue)}
                            </option>
                          ))}
                        </Select>
                        <p className="text-xs text-destructive">
                          {form.formState.errors.items?.[index]?.lineId?.message}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium sm:text-sm">Amount</Label>
                        <Controller
                          control={form.control}
                          name={`items.${index}.amount`}
                          render={({ field: { value, onChange, ref } }) => (
                            <CurrencyInput
                              value={value as any}
                              onValueChange={(values) => onChange(values.floatValue ?? 0)}
                              getInputRef={ref}
                            />
                          )}
                        />
                        <p className="text-xs text-destructive">
                          {form.formState.errors.items?.[index]?.amount?.message}
                        </p>
                      </div>
                    </div>
                    {selectedLine ? (
                      <div className="mt-3 rounded-2xl bg-background/80 p-3 text-[11px] text-muted-foreground sm:text-xs">
                        <p>
                          Item:{" "}
                          <span className="font-medium text-foreground">
                            {selectedLine.productName}
                          </span>
                        </p>
                        <p className="mt-1">
                          Sale:{" "}
                          <span className="font-medium text-foreground">
                            {selectedLine.saleNumber}
                          </span>{" "}
                          on {formatDateTime(selectedLine.soldAt)}
                        </p>
                        <p className="mt-1">
                          Sold qty:{" "}
                          <span className="font-medium text-foreground">
                            {selectedLine.quantity}
                          </span>
                        </p>
                        <p className="mt-1">
                          Still due:{" "}
                          <span className="font-medium text-foreground">
                            {formatCurrency(selectedLine.amountDue)}
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
                disabled={!canAppendLine}
                onClick={handleAppendItem}
              >
                <Plus className="h-4 w-4" />
                Add line
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle>Collection summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:space-y-4 sm:p-6 sm:pt-0">
          <div className="rounded-2xl bg-muted/60 p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Lines</p>
                <p className="mt-1 text-2xl font-semibold">{fields.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sold qty</p>
                <p className="mt-1 text-2xl font-semibold">{totalQuantity}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sales</p>
                <p className="mt-1 text-2xl font-semibold">{uniqueSales.size}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-muted/60 p-3 sm:p-4">
            <p className="text-xs text-muted-foreground">Total collection</p>
            <p className="mt-1 text-3xl font-semibold">{formatCurrency(totalAmount)}</p>
          </div>
          {/* Summary instructions removed for simplicity */}
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
            <Button className="sm:flex-1" type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Post collection"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
