"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { FormFeedback } from "@/components/forms/form-feedback";
import { SupplierForm } from "@/components/forms/supplier-form";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createPurchaseAction } from "@/lib/actions/purchases";
import type { PurchaseFormOptions } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import {
  purchaseSchema,
  type PurchaseFormInput,
} from "@/lib/validation/purchase";
import { formatFinanceAccountLabel } from "@/lib/finance-account-utils";

type PurchaseFormProps = {
  options: PurchaseFormOptions;
  initialBranchId?: string;
  initialProductId?: string;
  mode?: "page" | "modal";
  cancelHref?: Route;
  onCancel?: () => void;
  onSuccess?: () => void;
};

function PurchaseItemPicker({
  value,
  products,
  disabledProductIds,
  onValueChange,
}: {
  value: string;
  products: PurchaseFormOptions["products"];
  disabledProductIds: Set<string>;
  onValueChange: (value: string) => void;
}) {
  const selectedProduct = products.find((product) => product.id === value);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-primary/40 data-[state=open]:ring-2 data-[state=open]:ring-primary/20"
        >
          <span
            className={cn(
              "min-w-0 truncate text-left",
              selectedProduct ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {selectedProduct?.name ?? "Select item"}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        collisionPadding={12}
        className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)] max-w-[min(24rem,calc(100vw-2rem))] p-1"
      >
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          <DropdownMenuRadioItem value="">
            <span className="truncate">Select item</span>
          </DropdownMenuRadioItem>
          {products.map((product) => {
            const disabled =
              disabledProductIds.has(product.id) && product.id !== value;

            return (
              <DropdownMenuRadioItem
                key={product.id}
                value={product.id}
                disabled={disabled}
                className="max-w-full"
              >
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span className="truncate">{product.name}</span>
                  {disabled ? (
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Added
                    </span>
                  ) : null}
                </div>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getDefaultValues(
  options: PurchaseFormOptions,
  initialBranchId?: string,
  initialProductId?: string,
): PurchaseFormInput {
  const defaultProduct = options.products.find(
    (product) => product.id === initialProductId,
  );
  const defaultBranch =
    options.branches.find((branch) => branch.id === initialBranchId) ??
    options.branches[0];

  return {
    branchId: defaultBranch?.id ?? "",
    supplierId: "",
    paymentAccountId: "",
    settlementMode: "UNPAID",
    amountPaid: 0,
    purchasedAt: new Date().toISOString().slice(0, 16),
    note: "",
    items: [
      {
        productId: defaultProduct?.id ?? "",
        quantity: 1,
        unitCost: 0,
        sellingPrice: 0,
      },
    ],
  };
}

export function PurchaseForm({
  options,
  initialBranchId,
  initialProductId,
  mode = "page",
  cancelHref,
  onCancel,
  onSuccess,
}: PurchaseFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [supplierOptions, setSupplierOptions] = useState(options.suppliers);
  const [isSupplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const defaultValues = getDefaultValues(
    { ...options, suppliers: supplierOptions },
    initialBranchId,
    initialProductId,
  );
  const canSubmit =
    options.branches.length > 0 &&
    options.products.length > 0;

  const form = useForm<PurchaseFormInput>({
    resolver: zodResolver(purchaseSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const branchId = form.watch("branchId");
  const supplierId = form.watch("supplierId");
  const settlementMode = form.watch("settlementMode");
  const paymentAccountId = form.watch("paymentAccountId");
  const rawAmountPaid = Number(form.watch("amountPaid") || 0);
  const items = form.watch("items");
  const previousProductIds = useRef(defaultValues.items.map((item) => item.productId));
  const total = items.reduce((sum, item) => {
    return sum + Number(item.quantity || 0) * Number(item.unitCost || 0);
  }, 0);
  const availableAccounts = useMemo(
    () =>
      options.accounts.filter(
        (account) => !branchId || !account.branchId || account.branchId === branchId,
      ),
    [branchId, options.accounts],
  );
  const selectedProductIds = useMemo(
    () => new Set(items.map((item) => item.productId).filter(Boolean)),
    [items],
  );
  const hasUnusedProducts = useMemo(
    () => options.products.some((product) => !selectedProductIds.has(product.id)),
    [options.products, selectedProductIds],
  );
  const effectiveAmountPaid =
    settlementMode === "UNPAID"
      ? 0
      : settlementMode === "FULL"
        ? total
        : Math.min(rawAmountPaid, total);
  const amountDue = Math.max(total - effectiveAmountPaid, 0);
  const canPostWithPayment =
    settlementMode === "UNPAID" || availableAccounts.length > 0;

  useEffect(() => {
    items.forEach((item, index) => {
      const previousProductId = previousProductIds.current[index];

      if (item.productId === previousProductId) {
        return;
      }

      form.setValue(`items.${index}.unitCost`, 0, {
        shouldDirty: true,
      });
      form.setValue(`items.${index}.sellingPrice`, 0, {
        shouldDirty: true,
      });
    });

    previousProductIds.current = items.map((item) => item.productId);
  }, [form, items, options.products]);

  useEffect(() => {
    if (supplierOptions.length === 0) {
      if (supplierId) {
        form.setValue("supplierId", "", {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      return;
    }

    if (supplierId && !supplierOptions.some((supplier) => supplier.id === supplierId)) {
      form.setValue("supplierId", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, supplierId, supplierOptions]);

  useEffect(() => {
    if (
      settlementMode !== "UNPAID" &&
      availableAccounts.length > 0 &&
      !availableAccounts.some((account) => account.id === paymentAccountId)
    ) {
      form.setValue("paymentAccountId", availableAccounts[0]?.id ?? "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    if (settlementMode !== "UNPAID" && availableAccounts.length === 0 && paymentAccountId) {
      form.setValue("paymentAccountId", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    if (settlementMode === "UNPAID" && paymentAccountId) {
      form.setValue("paymentAccountId", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [availableAccounts, form, paymentAccountId, settlementMode]);

  useEffect(() => {
    if (settlementMode === "UNPAID") {
      if (rawAmountPaid !== 0) {
        form.setValue("amountPaid", 0, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      return;
    }

    if (settlementMode === "FULL" && rawAmountPaid !== total) {
      form.setValue("amountPaid", total, {
        shouldDirty: true,
        shouldValidate: true,
      });
      return;
    }

    if (settlementMode === "PARTIAL") {
      const suggestedPartial =
        total <= 0
          ? 0
          : Number(Math.max(0.01, Math.min(total - 0.01, total / 2)).toFixed(2));

      if (rawAmountPaid <= 0 || rawAmountPaid >= total) {
        form.setValue("amountPaid", suggestedPartial, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }
  }, [form, rawAmountPaid, settlementMode, total]);

  function getResetValues() {
    return {
      ...getDefaultValues(
        { ...options, suppliers: supplierOptions },
        form.getValues("branchId") || initialBranchId,
        initialProductId,
      ),
      branchId: form.getValues("branchId") || defaultValues.branchId,
      supplierId: form.getValues("supplierId") || "",
    } satisfies PurchaseFormInput;
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

  function onSubmit(values: PurchaseFormInput) {
    startTransition(async () => {
      setSubmitError(null);
      const result = await createPurchaseAction(values);

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
    if (!hasUnusedProducts) {
      toast.error("All items are already added. Increase quantity on the existing line instead.");
      return;
    }

    append({
      productId: "",
      quantity: 1,
      unitCost: 0,
      sellingPrice: 0,
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
            <CardTitle>Purchase entry</CardTitle>
            {!canSubmit ? (
              <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                Need branch and item.
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
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="branchId">Branch</Label>
              <Select id="branchId" {...form.register("branchId")}>
                {options.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} - {branch.name}
                  </option>
                ))}
              </Select>
              {form.formState.errors.branchId?.message ? (
                <p className="text-xs text-destructive">{form.formState.errors.branchId.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="supplierId">Supplier (optional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-primary"
                  onClick={() => setSupplierDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add supplier
                </Button>
              </div>
              <Select id="supplierId" {...form.register("supplierId")}>
                <option value="">Select supplier</option>
                {supplierOptions.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Leave blank for a direct purchase paid now. Choose a supplier if this purchase
                needs payable tracking or later settlement.
              </p>
              {form.formState.errors.supplierId?.message ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.supplierId.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3">
            <div className="w-full max-w-[18rem] space-y-2 sm:max-w-[19rem]">
              <Label htmlFor="purchasedAt">Purchase date</Label>
              <Input id="purchasedAt" type="datetime-local" {...form.register("purchasedAt")} />
              {form.formState.errors.purchasedAt?.message ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.purchasedAt.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Line items
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
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,3.7fr)_minmax(88px,0.6fr)_minmax(124px,0.9fr)_minmax(136px,0.95fr)] lg:items-end">
                    <div className="col-span-2 space-y-2 lg:col-span-1">
                      <Label className="text-xs font-medium sm:text-sm">Item name</Label>
                      <PurchaseItemPicker
                        value={items[index]?.productId ?? ""}
                        products={options.products}
                        disabledProductIds={
                          new Set(
                            items
                              .filter((_, itemIndex) => itemIndex !== index)
                              .map((item) => item.productId)
                              .filter(Boolean),
                          )
                        }
                        onValueChange={(nextValue) =>
                          form.setValue(`items.${index}.productId`, nextValue, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                      />
                      {items.some(
                        (item, itemIndex) =>
                          itemIndex !== index &&
                          item.productId &&
                          item.productId === items[index]?.productId,
                      ) ? (
                        <p className="text-xs text-muted-foreground">
                          This item is already added. Increase its quantity on the existing line instead.
                        </p>
                      ) : null}
                      {form.formState.errors.items?.[index]?.productId?.message ? (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.items[index]?.productId?.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium sm:text-sm">Qty</Label>
                      <Input type="number" min={1} {...form.register(`items.${index}.quantity`)} />
                      {form.formState.errors.items?.[index]?.quantity?.message ? (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.items[index]?.quantity?.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium sm:text-sm">Buying Price</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        {...form.register(`items.${index}.unitCost`)}
                      />
                      {form.formState.errors.items?.[index]?.unitCost?.message ? (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.items[index]?.unitCost?.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="col-span-2 space-y-2 lg:col-span-1">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs font-medium sm:text-sm">Selling Price</Label>
                        {index > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0 rounded-lg border-destructive/35 bg-background/80 text-destructive shadow-sm hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        {...form.register(`items.${index}.sellingPrice`)}
                      />
                      {form.formState.errors.items?.[index]?.sellingPrice?.message ? (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.items[index]?.sellingPrice?.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={options.products.length === 0}
                onClick={handleAppendItem}
              >
                <Plus className="h-4 w-4" />
                Add item
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
        <Card>
        <CardHeader>
          <CardTitle>Purchase summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:space-y-4 sm:p-6 sm:pt-0">
          <div className="rounded-2xl bg-muted/60 p-3 sm:p-4">
            <p className="text-sm text-muted-foreground">Calculated total</p>
            <p className="mt-2 text-3xl font-semibold">{formatCurrency(total)}</p>
          </div>
          <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-3 sm:space-y-4 sm:p-4">
            <div className="space-y-2">
              <Label htmlFor="purchase-settlement-mode">Payment option</Label>
              <Select id="purchase-settlement-mode" {...form.register("settlementMode")}>
                <option value="UNPAID">Pay later</option>
                <option value="FULL">Pay full now</option>
                <option value="PARTIAL">Pay part now</option>
              </Select>
            </div>
            {settlementMode !== "UNPAID" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="purchase-payment-account">Payment account</Label>
                  <Select id="purchase-payment-account" {...form.register("paymentAccountId")}>
                    <option value="">Select payment account</option>
                    {availableAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {formatFinanceAccountLabel(account)}
                      </option>
                    ))}
                  </Select>
                  {form.formState.errors.paymentAccountId?.message ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.paymentAccountId.message}
                    </p>
                  ) : null}
                </div>
                {settlementMode === "PARTIAL" ? (
                  <div className="space-y-2">
                    <Label htmlFor="purchase-amount-paid">Amount paid now</Label>
                    <Input
                      id="purchase-amount-paid"
                      type="number"
                      min={0.01}
                      max={total || undefined}
                      step="0.01"
                      {...form.register("amountPaid")}
                    />
                    {form.formState.errors.amountPaid?.message ? (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.amountPaid.message}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {availableAccounts.length === 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    No active cash or bank account is available for this branch yet. Create one in Finance before paying during purchase creation.
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="rounded-2xl bg-muted/60 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Paid now</span>
              <span className="font-semibold">{formatCurrency(effectiveAmountPaid)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Balance due</span>
              <span className="font-semibold">{formatCurrency(amountDue)}</span>
            </div>
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
              disabled={isPending || !canSubmit || !canPostWithPayment}
            >
              {isPending ? "Saving..." : "Save purchase"}
            </Button>
          </div>
        </CardContent>
        </Card>
      </form>
      <Dialog open={isSupplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add supplier</DialogTitle>
            <DialogDescription>
              Create a supplier without leaving the purchase entry.
            </DialogDescription>
          </DialogHeader>
          <SupplierForm
            submitLabel="Save supplier"
            refreshAfterSuccess={false}
            onCancel={() => setSupplierDialogOpen(false)}
            onSuccess={(supplier) => {
              setSupplierOptions((current) =>
                [...current, supplier].sort((left, right) =>
                  left.name.localeCompare(right.name),
                ),
              );
              form.setValue("supplierId", supplier.id, {
                shouldDirty: true,
                shouldValidate: true,
              });
              setSupplierDialogOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
