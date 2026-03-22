"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { CustomerForm } from "@/components/forms/customer-form";
import { FormFeedback } from "@/components/forms/form-feedback";
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
import { Textarea } from "@/components/ui/textarea";
import { createSaleAction } from "@/lib/actions/sales";
import { formatFinanceAccountLabel } from "@/lib/finance-account-utils";
import type { SaleFormOptions } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { saleSchema, type SaleFormInput } from "@/lib/validation/sale";

type SaleFormProps = {
  options: SaleFormOptions;
  initialBranchId?: string;
  initialProductId?: string;
  mode?: "page" | "modal";
  cancelHref?: Route;
  onCancel?: () => void;
  onSuccess?: () => void;
};

function getOwnedBatchesForLine(
  options: SaleFormOptions,
  branchId: string | undefined,
  productId: string | undefined,
) {
  if (!branchId || !productId) {
    return [];
  }

  return options.ownedBatches.filter(
    (batch) => batch.branchId === branchId && batch.productId === productId,
  );
}

function getAvailableProductsForBranch(
  options: SaleFormOptions,
  branchId: string | undefined,
) {
  if (!branchId) {
    return options.products;
  }

  const availableProductIds = new Set(
    options.branchStock
      .filter((item) => item.branchId === branchId && item.availableQty > 0)
      .map((item) => item.productId),
  );

  return options.products.filter((product) => availableProductIds.has(product.id));
}

function getBranchProductStock(
  options: SaleFormOptions,
  branchId: string | undefined,
  productId: string | undefined,
) {
  if (!branchId || !productId) {
    return null;
  }

  return (
    options.branchStock.find(
      (item) => item.branchId === branchId && item.productId === productId,
    ) ?? null
  );
}

function getAvailableAccountsForSale(
  options: SaleFormOptions,
  branchId: string | undefined,
  paymentMethod: SaleFormInput["paymentMethod"],
) {
  if (paymentMethod === "CREDIT") {
    return [];
  }

  return options.accounts.filter(
    (account) =>
      (!branchId || !account.branchId || account.branchId === branchId) &&
      account.type === paymentMethod,
  );
}

function getDefaultValues(
  options: SaleFormOptions,
  initialBranchId?: string,
  initialProductId?: string,
): SaleFormInput {
  const selectedBranch =
    options.branches.find((branch) => branch.id === initialBranchId) ??
    options.branches[0];
  const branchProducts = getAvailableProductsForBranch(options, selectedBranch?.id);
  const defaultProduct =
    branchProducts.find((product) => product.id === initialProductId) ?? branchProducts[0];
  const defaultBatches = getOwnedBatchesForLine(
    options,
    selectedBranch?.id,
    defaultProduct?.id,
  );
  const defaultCashAccounts = getAvailableAccountsForSale(
    options,
    selectedBranch?.id,
    "CASH",
  );
  const defaultBankAccounts = getAvailableAccountsForSale(
    options,
    selectedBranch?.id,
    "BANK",
  );
  const defaultPaymentMethod = defaultCashAccounts[0]
    ? "CASH"
    : defaultBankAccounts[0]
      ? "BANK"
      : "CREDIT";
  const defaultFinanceAccount =
    defaultPaymentMethod === "BANK" ? defaultBankAccounts[0] : defaultCashAccounts[0];
  const defaultStock = getBranchProductStock(
    options,
    selectedBranch?.id,
    defaultProduct?.id,
  );

  return {
    branchId: selectedBranch?.id ?? "",
    customerId: "",
    paymentMethod: defaultPaymentMethod,
    financeAccountId: defaultFinanceAccount?.id ?? "",
    soldAt: new Date().toISOString().slice(0, 16),
    note: "",
    items: [
      {
        productId: defaultProduct?.id ?? "",
        ownedBatchId: "",
        quantity: 1,
        unitPrice: defaultBatches[0]?.sellingPrice ?? defaultStock?.defaultUnitPrice ?? 0,
        discount: 0,
      },
    ],
  };
}

export function SaleForm({
  options,
  initialBranchId,
  initialProductId,
  mode = "page",
  cancelHref,
  onCancel,
  onSuccess,
}: SaleFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customerOptions, setCustomerOptions] = useState(options.customers);
  const [isCustomerDialogOpen, setCustomerDialogOpen] = useState(false);
  const defaultValues = getDefaultValues(options, initialBranchId, initialProductId);
  const defaultBranchProducts = getAvailableProductsForBranch(
    options,
    defaultValues.branchId,
  );
  const defaultProduct =
    defaultBranchProducts.find((product) => product.id === initialProductId) ??
    defaultBranchProducts[0];

  const form = useForm<SaleFormInput>({
    resolver: zodResolver(saleSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const branchId = form.watch("branchId");
  const customerId = form.watch("customerId");
  const paymentMethod = form.watch("paymentMethod");
  const financeAccountId = form.watch("financeAccountId");
  const items = form.watch("items");
  const currentBranchProducts = getAvailableProductsForBranch(options, branchId);
  const availablePaymentAccounts = getAvailableAccountsForSale(
    options,
    branchId,
    paymentMethod,
  );
  const canSubmit = options.branches.length > 0 && currentBranchProducts.length > 0;
  const canPostWithPaymentAccount =
    paymentMethod === "CREDIT" || availablePaymentAccounts.length > 0;
  const previousBranchId = useRef(defaultValues.branchId);
  const previousLineState = useRef(
    defaultValues.items.map((item) => ({
      productId: item.productId,
      ownedBatchId: item.ownedBatchId ?? "",
    })),
  );
  const grossTotal = items.reduce((sum, item) => {
    return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
  }, 0);
  const discountTotal = items.reduce((sum, item) => {
    return sum + Number(item.quantity || 0) * Number(item.discount || 0);
  }, 0);
  const total = grossTotal - discountTotal;

  useEffect(() => {
    const branchChanged = branchId !== previousBranchId.current;

    items.forEach((item, index) => {
      const previousLine = previousLineState.current[index];
      const availableProducts = getAvailableProductsForBranch(options, branchId);
      const fallbackProductId = availableProducts[0]?.id ?? "";
      const productStillAvailable = availableProducts.some(
        (product) => product.id === item.productId,
      );
      const nextProductId = productStillAvailable ? item.productId : fallbackProductId;
      const stockEntry = getBranchProductStock(options, branchId, nextProductId);
      const availableBatches = getOwnedBatchesForLine(
        options,
        branchId,
        nextProductId,
      );
      const selectedBatch = availableBatches.find(
        (batch) => batch.id === item.ownedBatchId,
      );
      const previousProductId = previousLine?.productId;
      const previousOwnedBatchId = previousLine?.ownedBatchId ?? "";
      const productChanged = item.productId !== previousProductId;
      const batchChanged = (item.ownedBatchId ?? "") !== previousOwnedBatchId;
      const batchStillValid =
        !item.ownedBatchId ||
        availableBatches.some((batch) => batch.id === item.ownedBatchId);

      if (!productStillAvailable && item.productId !== nextProductId) {
        form.setValue(`items.${index}.productId`, nextProductId, {
          shouldDirty: true,
        });
      }

      if (!batchStillValid) {
        form.setValue(`items.${index}.ownedBatchId`, "", {
          shouldDirty: true,
        });
      }

      if (!productChanged && !batchChanged && !branchChanged) {
        return;
      }

      form.setValue(
        `items.${index}.unitPrice`,
        selectedBatch?.sellingPrice ??
          availableBatches[0]?.sellingPrice ??
          stockEntry?.defaultUnitPrice ??
          0,
        {
          shouldDirty: true,
        },
      );
      form.setValue(`items.${index}.discount`, 0, {
        shouldDirty: true,
      });
    });

    previousBranchId.current = branchId;
    previousLineState.current = items.map((item) => ({
      productId: item.productId,
      ownedBatchId: item.ownedBatchId ?? "",
    }));
  }, [branchId, form, items, options]);

  useEffect(() => {
    if (!customerId) {
      return;
    }

    if (!customerOptions.some((customer) => customer.id === customerId)) {
      form.setValue("customerId", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [customerId, customerOptions, form]);

  useEffect(() => {
    if (paymentMethod === "CREDIT") {
      if (financeAccountId) {
        form.setValue("financeAccountId", "", {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      return;
    }

    if (!availablePaymentAccounts.some((account) => account.id === financeAccountId)) {
      form.setValue("financeAccountId", availablePaymentAccounts[0]?.id ?? "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [availablePaymentAccounts, financeAccountId, form, paymentMethod]);

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

  function onSubmit(values: SaleFormInput) {
    startTransition(async () => {
      setSubmitError(null);
      const result = await createSaleAction(values);

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
    <>
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
          <CardTitle>Fast sale screen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormFeedback
            errors={form.formState.errors}
            submitError={submitError}
            showValidationSummary={form.formState.submitCount > 0}
          />
          {!canSubmit ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {options.branchStock.length === 0
                ? "No sellable stock is available in your assigned branches yet."
                : "No sellable stock is available in the selected branch."}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sale-branch">Branch</Label>
              <Select id="sale-branch" {...form.register("branchId")}>
                {options.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} - {branch.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="customerId">Customer</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-primary"
                  onClick={() => setCustomerDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add customer
                </Button>
              </div>
              <Select id="customerId" {...form.register("customerId")}>
                <option value="">Walk-in Customer</option>
                {customerOptions.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Leave this as walk-in for cash or bank sales when no customer record is needed.
                Credit sales require a customer.
              </p>
              <p className="text-xs text-destructive">
                {form.formState.errors.customerId?.message}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment method</Label>
              <Select id="paymentMethod" {...form.register("paymentMethod")}>
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
                <option value="CREDIT">Credit</option>
              </Select>
              <p className="text-xs text-destructive">
                {form.formState.errors.paymentMethod?.message}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="soldAt">Sale date</Label>
              <Input id="soldAt" type="datetime-local" {...form.register("soldAt")} />
              <p className="text-xs text-destructive">
                {form.formState.errors.soldAt?.message}
              </p>
            </div>
          </div>
          {paymentMethod !== "CREDIT" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="financeAccountId">
                  {paymentMethod === "BANK" ? "Bank account" : "Cash account"}
                </Label>
                <Select id="financeAccountId" {...form.register("financeAccountId")}>
                  <option value="">
                    {paymentMethod === "BANK"
                      ? "Select bank account"
                      : "Select cash account"}
                  </option>
                  {availablePaymentAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {formatFinanceAccountLabel(account)}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  {paymentMethod === "BANK"
                    ? "Bank sales post into the selected bank account."
                    : "Cash sales post into the single branch cash account."}
                </p>
                <p className="text-xs text-destructive">
                  {form.formState.errors.financeAccountId?.message}
                </p>
              </div>
              {availablePaymentAccounts.length === 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  No active {paymentMethod === "BANK" ? "bank" : "cash"} account is available for
                  this branch yet.
                </div>
              ) : (
                <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
                  The selected account will receive the full paid amount for this sale.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
              Credit sales do not hit cash or bank until you record a payment later.
            </div>
          )}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Sale lines
              </h3>
            </div>
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-4 dark:border-primary/20 dark:bg-primary/[0.08]"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/85">
                      Sale line {index + 1}
                    </p>
                    {index > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0 rounded-lg border-destructive/35 bg-background/80 text-destructive shadow-sm hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[2fr_1.6fr_1fr_1fr_1fr]">
                    {(() => {
                      const branchProducts = getAvailableProductsForBranch(options, branchId);
                      const stockEntry = getBranchProductStock(
                        options,
                        branchId,
                        items[index]?.productId,
                      );
                      const lineBatches = getOwnedBatchesForLine(
                        options,
                        branchId,
                        items[index]?.productId,
                      );
                      const selectedBatch = lineBatches.find(
                        (batch) => batch.id === items[index]?.ownedBatchId,
                      );
                      const maxQuantity =
                        selectedBatch?.remainingQuantity ?? stockEntry?.availableQty ?? 0;
                      const currentQuantity = Number(items[index]?.quantity ?? 1);

                      return (
                        <>
                    <div className="space-y-2">
                      <Label>Item name</Label>
                      <Select {...form.register(`items.${index}.productId`)}>
                        {branchProducts.length === 0 ? (
                          <option value="">No stock available in this branch</option>
                        ) : null}
                        {branchProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Batch</Label>
                      <Select {...form.register(`items.${index}.ownedBatchId`)}>
                        <option value="">Auto select (FIFO)</option>
                        {lineBatches.map((batch) => (
                          <option key={batch.id} value={batch.id}>
                            {batch.referenceNumber} | {batch.sourceName} | {batch.remainingQuantity} left | {formatCurrency(batch.sellingPrice)}
                          </option>
                        ))}
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {lineBatches.length > 0
                          ? "Select an owned batch to sell from a specific lot, or leave auto for FIFO."
                          : stockEntry
                            ? "This item has no remaining owned batch to choose here. The sale will allocate automatically from the available stock source."
                            : "Select an in-stock item first."}
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
                              `items.${index}.quantity`,
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
                          {...form.register(`items.${index}.quantity`)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-none rounded-r-xl"
                          disabled={maxQuantity > 0 ? currentQuantity >= maxQuantity : false}
                          onClick={() =>
                            form.setValue(`items.${index}.quantity`, currentQuantity + 1, {
                              shouldDirty: true,
                            })
                          }
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {maxQuantity > 0
                          ? `Available to sell: ${maxQuantity}`
                          : "No quantity is available for this item in the selected branch."}
                      </p>
                      <p className="text-xs text-destructive">
                        {form.formState.errors.items?.[index]?.quantity?.message}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Unit Price</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        {...form.register(`items.${index}.unitPrice`)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Defaults from the selected batch or the earliest available stock. You can still override it for this sale.
                      </p>
                      <p className="text-xs text-destructive">
                        {form.formState.errors.items?.[index]?.unitPrice?.message}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Discount / Unit</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        {...form.register(`items.${index}.discount`)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Applied per unit before the line total is calculated.
                      </p>
                      <p className="text-xs text-destructive">
                        {form.formState.errors.items?.[index]?.discount?.message}
                      </p>
                    </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={getAvailableProductsForBranch(options, branchId).length === 0}
                onClick={() => {
                  const branchProducts = getAvailableProductsForBranch(options, branchId);
                  const nextProduct = branchProducts[0];
                  const nextStock = getBranchProductStock(options, branchId, nextProduct?.id);

                  append({
                    productId: nextProduct?.id ?? "",
                    ownedBatchId: "",
                    quantity: 1,
                    unitPrice:
                      getOwnedBatchesForLine(options, branchId, nextProduct?.id)[0]
                        ?.sellingPrice ??
                      nextStock?.defaultUnitPrice ??
                      0,
                    discount: 0,
                  });
                }}
              >
                <Plus className="h-4 w-4" />
                Add item
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sale-note">Note</Label>
            <Textarea id="sale-note" rows={3} {...form.register("note")} />
          </div>
        </CardContent>
      </Card>
        <Card>
        <CardHeader>
          <CardTitle>Receipt summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Gross total</p>
            <p className="mt-2 text-xl font-semibold">{formatCurrency(grossTotal)}</p>
          </div>
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Discount total</p>
            <p className="mt-2 text-xl font-semibold">{formatCurrency(discountTotal)}</p>
          </div>
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Calculated total</p>
            <p className="mt-2 text-3xl font-semibold">{formatCurrency(total)}</p>
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
            <Button
              className="sm:flex-1"
              type="submit"
              disabled={isPending || !canSubmit || !canPostWithPaymentAccount}
            >
              {isPending ? "Saving..." : "Save sale"}
            </Button>
          </div>
        </CardContent>
        </Card>
      </form>
      <Dialog open={isCustomerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add customer</DialogTitle>
            <DialogDescription>
              Create a customer without leaving the sale screen. You can still leave the sale as walk-in.
            </DialogDescription>
          </DialogHeader>
          <CustomerForm
            submitLabel="Save customer"
            refreshAfterSuccess={false}
            onCancel={() => setCustomerDialogOpen(false)}
            onSuccess={(customer) => {
              setCustomerOptions((current) =>
                [...current, customer].sort((left, right) =>
                  left.name.localeCompare(right.name),
                ),
              );
              form.setValue("customerId", customer.id, {
                shouldDirty: true,
                shouldValidate: true,
              });
              setCustomerDialogOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
