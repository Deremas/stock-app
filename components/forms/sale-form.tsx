"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm, Controller } from "react-hook-form";
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
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createSaleAction } from "@/lib/actions/sales";
import { formatFinanceAccountLabel } from "@/lib/finance-account-utils";
import type { SaleFormOptions } from "@/lib/types";
import { calculateTax } from "@/lib/tax";
import { formatCurrency, formatDateForInput } from "@/lib/utils";
import { saleSchema, type SaleFormInput } from "@/lib/validation/sale";

type SaleFormProps = {
  options: SaleFormOptions;
  userRole?: string;
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

  if (paymentMethod === "MIXED") {
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
    financeAccountId: "",
    mixedCashAmount: 0,
    mixedCashAccountId: defaultCashAccounts[0]?.id ?? "",
    mixedBankAmount: 0,
    mixedBankAccountId: defaultBankAccounts[0]?.id ?? "",
    mixedCreditAmount: 0,
    soldAt: formatDateForInput(),
    applyVat: false,
    note: "",
    items: [
      {
        productId: defaultProduct?.id ?? "",
        ownedBatchId: defaultBatches[0]?.id ?? "",
        quantity: 1,
        unitPrice: defaultStock?.defaultUnitPrice ?? 0,
        discount: 0,
        fixedDiscount: 0,
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
  const [success, setSuccess] = useState<{
    title: string;
    message: string;
    nextSteps: { label: string; href: string }[];
  } | null>(null);
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
  const mixedCashAmount = Number(form.watch("mixedCashAmount") || 0);
  const mixedCashAccountId = form.watch("mixedCashAccountId");
  const mixedBankAmount = Number(form.watch("mixedBankAmount") || 0);
  const mixedBankAccountId = form.watch("mixedBankAccountId");
  const mixedCreditAmount = Number(form.watch("mixedCreditAmount") || 0);
  const applyVat = form.watch("applyVat");
  const items = form.watch("items");
  const currentBranchProducts = getAvailableProductsForBranch(options, branchId);
  const availablePaymentAccounts = getAvailableAccountsForSale(
    options,
    branchId,
    paymentMethod,
  );
  const availableCashAccounts = options.accounts.filter(
    (account) =>
      account.type === "CASH" &&
      (!branchId || !account.branchId || account.branchId === branchId),
  );
  const availableBankAccounts = options.accounts.filter(
    (account) =>
      account.type === "BANK" &&
      (!branchId || !account.branchId || account.branchId === branchId),
  );
  const mixedAllocatedTotal =
    mixedCashAmount + mixedBankAmount + mixedCreditAmount;
  const mixedActiveMethods = [
    mixedCashAmount > 0,
    mixedBankAmount > 0,
    mixedCreditAmount > 0,
  ].filter(Boolean).length;
  const canSubmit = options.branches.length > 0 && currentBranchProducts.length > 0;
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
    return sum + (Number(item.quantity || 0) * Number(item.discount || 0)) + Number(item.fixedDiscount || 0);
  }, 0);
  const netBeforeTax = grossTotal - discountTotal;
  const salesVatAvailable =
    options.taxSettings.vatEnabled && options.taxSettings.salesVatEnabled;
  const tax = calculateTax({
    amount: netBeforeTax,
    enabled: salesVatAvailable && Boolean(applyVat),
    rate: options.taxSettings.defaultSalesVatRate,
    priceMode: options.taxSettings.salesPriceMode,
  });
  const total = tax.total;
  const canPostWithPaymentAccount =
    paymentMethod === "CREDIT" ||
    (paymentMethod === "MIXED"
      ? mixedActiveMethods >= 2 &&
        Math.abs(mixedAllocatedTotal - total) < 0.005 &&
        (mixedCashAmount <= 0 || Boolean(mixedCashAccountId)) &&
        (mixedBankAmount <= 0 || Boolean(mixedBankAccountId)) &&
        (mixedCreditAmount <= 0 || Boolean(customerId))
      : availablePaymentAccounts.length > 0);

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
      const productStillValid = item.productId === "" || availableProducts.some(p => p.id === item.productId);
      if (!productStillValid) {
        form.setValue(`items.${index}.productId`, "", { shouldDirty: true });
        form.setValue(`items.${index}.ownedBatchId`, "", { shouldDirty: true });
        form.setValue(`items.${index}.unitPrice`, 0, { shouldDirty: true });
      }
    });
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
      if (financeAccountId !== "") {
        form.setValue("financeAccountId", "", {
          shouldDirty: true,
        });
      }
      return;
    }

    if (paymentMethod === "CASH" && availablePaymentAccounts.length > 0) {
      if (financeAccountId !== (availablePaymentAccounts[0]!.id as string)) {
        form.setValue("financeAccountId", availablePaymentAccounts[0]!.id as string, {
          shouldDirty: true,
        });
      }
    } else {
      if (financeAccountId !== "" && !availablePaymentAccounts.some((account) => account.id === financeAccountId)) {
        form.setValue("financeAccountId", "", {
          shouldDirty: true,
        });
      }
    }
  }, [availablePaymentAccounts, financeAccountId, form, paymentMethod]);

  function handleCancel() {
    setSubmitError(null);
    setSuccess(null);
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
      setSuccess(null);
      const result = await createSaleAction(values);

      if (!result.success) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }

      setSubmitError(null);
      setSuccess({
        title: "Sale Successful",
        message: `Successfully recorded sale of ${items.length} item(s) for a total of ${formatCurrency(total)}.`,
        nextSteps: [
          { label: "New Sale", href: "/sales/new" },
          { label: "Go to Dashboard", href: "/dashboard" },
        ],
      });
      toast.success(result.message);
      form.reset(defaultValues);
      router.refresh();
      onSuccess?.();
    });
  }

  return (
    <>
      <form
        className="grid gap-6 xl:grid-cols-[2.8fr_1fr]"
        onChangeCapture={() => {
          if (submitError) setSubmitError(null);
          if (success) setSuccess(null);
        }}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <Card>
          <CardContent className="space-y-6 pt-6">
            <FormFeedback
              errors={form.formState.errors}
              submitError={submitError}
              success={success}
              showValidationSummary={form.formState.submitCount > 0}
            />
            {success ? null : (
              <>
                {!canSubmit ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    {options.branchStock.length === 0
                      ? "No sellable stock is available in your assigned branches yet."
                      : "No sellable stock is available in the selected branch."}
                  </div>
                ) : null}
                <div className="grid grid-cols-12 gap-x-4 gap-y-4">
                  {options.branches.length > 1 ? (
                    <div className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3 xl:col-span-2 space-y-1.5 flex flex-col justify-end">
                      <Label htmlFor="sale-branch">Branch</Label>
                      <Select id="sale-branch" {...form.register("branchId")}>
                        <option value="">Select branch</option>
                        {options.branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : (
                    <div className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3 xl:col-span-2 space-y-1.5 flex flex-col justify-end">
                      <Label>Branch</Label>
                      <div className="flex h-10 w-full items-center rounded-xl border border-input bg-muted px-3 py-2 text-sm text-muted-foreground ring-offset-background">
                        {options.branches.find((b) => b.id === branchId)?.name ?? "Active Branch"}
                      </div>
                      {/* Hidden input to keep branchId in form state */}
                      <input type="hidden" {...form.register("branchId")} />
                    </div>
                  )}
                  <div className="col-span-12 sm:col-span-6 md:col-span-8 lg:col-span-5 xl:col-span-4 space-y-1.5 flex flex-col justify-end">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="customerId">Customer</Label>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 px-3 text-xs"
                        onClick={() => setCustomerDialogOpen(true)}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add
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
                  </div>
                  <div className="col-span-6 sm:col-span-4 md:col-span-4 lg:col-span-2 xl:col-span-2 space-y-1.5 flex flex-col justify-end">
                    <Label htmlFor="paymentMethod">Payment method</Label>
                    <Select id="paymentMethod" {...form.register("paymentMethod")}>
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bank</option>
                      <option value="MIXED">Split payment</option>
                      <option value="CREDIT">Credit</option>
                    </Select>
                  </div>
                  <div className="col-span-6 sm:col-span-4 md:col-span-4 lg:col-span-2 xl:col-span-2 space-y-1.5 flex flex-col justify-end">
                    {paymentMethod !== "CREDIT" && paymentMethod !== "MIXED" ? (
                      <div className="flex flex-col justify-end w-full">
                        <Label htmlFor="financeAccountId" className="mb-1.5">
                          {paymentMethod === "BANK" ? "Bank account" : "Cash account"}
                        </Label>
                        <Select id="financeAccountId" {...form.register("financeAccountId")}>
                          <option value="">
                            {paymentMethod === "BANK"
                              ? "Select bank"
                              : "Select cash"}
                          </option>
                          {availablePaymentAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {formatFinanceAccountLabel(account)}
                            </option>
                          ))}
                        </Select>
                      </div>
                    ) : (
                      <div className="h-10 flex items-center">
                        <p className="text-xs text-muted-foreground italic">Credit sale</p>
                      </div>
                    )}
                  </div>
                  <div className="col-span-12 sm:col-span-4 md:col-span-4 lg:col-span-3 xl:col-span-3 space-y-1.5 flex flex-col justify-end">
                    <Label htmlFor="soldAt">Sale date</Label>
                    <Input id="soldAt" type="datetime-local" {...form.register("soldAt")} />
                  </div>
                </div>
                {paymentMethod !== "CREDIT" &&
                paymentMethod !== "MIXED" &&
                availablePaymentAccounts.length === 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    No active {paymentMethod === "BANK" ? "bank" : "cash"} account is available for
                    this branch yet.
                  </div>
                ) : null}
                {paymentMethod === "MIXED" ? (
                  <div className="grid gap-4 rounded-2xl border border-border bg-muted/20 p-4 md:grid-cols-3">
                    <div className="space-y-3">
                      <Label>Cash portion</Label>
                      <Controller
                        control={form.control}
                        name="mixedCashAmount"
                        render={({ field }) => (
                          <CurrencyInput
                            value={Number(field.value ?? 0)}
                            onValueChange={(value) => field.onChange(value.floatValue ?? 0)}
                            placeholder="0.00"
                          />
                        )}
                      />
                      <Select {...form.register("mixedCashAccountId")} disabled={mixedCashAmount <= 0}>
                        <option value="">Select cash account</option>
                        {availableCashAccounts.map((account) => (
                          <option key={account.id} value={account.id}>{formatFinanceAccountLabel(account)}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <Label>Bank portion</Label>
                      <Controller
                        control={form.control}
                        name="mixedBankAmount"
                        render={({ field }) => (
                          <CurrencyInput
                            value={Number(field.value ?? 0)}
                            onValueChange={(value) => field.onChange(value.floatValue ?? 0)}
                            placeholder="0.00"
                          />
                        )}
                      />
                      <Select {...form.register("mixedBankAccountId")} disabled={mixedBankAmount <= 0}>
                        <option value="">Select bank account</option>
                        {availableBankAccounts.map((account) => (
                          <option key={account.id} value={account.id}>{formatFinanceAccountLabel(account)}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <Label>Credit portion</Label>
                      <Controller
                        control={form.control}
                        name="mixedCreditAmount"
                        render={({ field }) => (
                          <CurrencyInput
                            value={Number(field.value ?? 0)}
                            onValueChange={(value) => field.onChange(value.floatValue ?? 0)}
                            placeholder="0.00"
                          />
                        )}
                      />
                      <p className="text-xs text-muted-foreground">Credit requires a selected customer.</p>
                    </div>
                    <div className="md:col-span-3 flex items-center justify-between rounded-xl bg-background px-4 py-3 text-sm">
                      <span className="text-muted-foreground">Allocated / difference</span>
                      <span className="font-semibold">
                        {formatCurrency(mixedAllocatedTotal)} / {formatCurrency(total - mixedAllocatedTotal)}
                      </span>
                    </div>
                  </div>
                ) : null}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Sale lines
                    </h3>
                  </div>
                  <div className="space-y-2 md:-mx-6 md:overflow-x-auto md:overflow-y-hidden md:px-6 md:pb-4">
                    <div className="md:min-w-[900px] md:space-y-2">
                      <div className="mb-2 hidden gap-3 px-4 md:grid md:grid-cols-[minmax(140px,2fr)_minmax(120px,1.6fr)_minmax(100px,1fr)_minmax(110px,1.2fr)_minmax(90px,0.9fr)_minmax(90px,0.9fr)_40px]">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Item Name</Label>
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Source</Label>
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Qty</Label>
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Unit Price</Label>
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Disc / Qty</Label>
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Fixed Disc</Label>
                        <div />
                      </div>
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="relative rounded-2xl border border-primary/15 bg-primary/[0.035] p-4 dark:border-primary/20 dark:bg-primary/[0.08] md:bg-transparent md:p-1 md:border-0 md:rounded-none"
                      >
                        <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/85">
                            Sale line {index + 1}
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
                        <div className="grid grid-cols-12 gap-x-3 gap-y-2 md:grid-cols-[minmax(140px,2fr)_minmax(120px,1.6fr)_minmax(100px,1fr)_minmax(110px,1.2fr)_minmax(90px,0.9fr)_minmax(90px,0.9fr)_40px] md:gap-3 md:px-4 md:items-center">
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
                                <div className="col-span-6 min-w-0 space-y-1 md:col-span-1">
                                  <Label className="text-[10px] uppercase text-muted-foreground md:hidden">Item name</Label>
                                  <Select 
                                    {...form.register(`items.${index}.productId`, {
                                      onChange: (e) => {
                                        const pId = e.target.value;
                                        const stockEntry = getBranchProductStock(options, branchId, pId);
                                        form.setValue(`items.${index}.unitPrice`, stockEntry?.defaultUnitPrice ?? 0, {
                                          shouldDirty: true,
                                        });
                                        form.setValue(`items.${index}.ownedBatchId`, "", { shouldDirty: true });
                                        form.setValue(`items.${index}.discount`, 0, { shouldDirty: true });
                                        form.setValue(`items.${index}.fixedDiscount`, 0, { shouldDirty: true });
                                      }
                                    })}
                                  >
                                    <option value="">Select item</option>
                                    {branchProducts.map((product) => (
                                      <option key={product.id} value={product.id}>
                                        {product.name}
                                      </option>
                                    ))}
                                  </Select>
                                </div>
                                <div className="col-span-6 min-w-0 space-y-1 md:col-span-1">
                                  <Label className="text-[10px] uppercase text-muted-foreground md:hidden">Source</Label>
                                  <Select 
                                    {...form.register(`items.${index}.ownedBatchId`, {
                                      onChange: (e) => {
                                        const bId = e.target.value;
                                        const batch = lineBatches.find((b) => b.id === bId);
                                        if (batch) {
                                          form.setValue(`items.${index}.unitPrice`, batch.sellingPrice, {
                                            shouldDirty: true,
                                          });
                                        }
                                      }
                                    })}
                                  >
                                    <option value="">Auto select (FIFO)</option>
                                    {lineBatches.map((batch) => (
                                      <option key={batch.id} value={batch.id}>
                                        {batch.referenceNumber} | {batch.sourceName} | {batch.remainingQuantity} left | {formatCurrency(batch.sellingPrice)}
                                      </option>
                                    ))}
                                  </Select>
                                </div>
                                <div className="col-span-4 min-w-0 space-y-1 sm:col-span-2 md:col-span-1 relative">
                                  <Label className="text-[10px] uppercase text-muted-foreground md:hidden">Qty</Label>
                                  <div className="flex items-center gap-0.5 rounded-xl border border-border bg-background p-0.5">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-lg bg-secondary/50 text-secondary-foreground hover:bg-secondary"
                                      disabled={currentQuantity <= 1}
                                      onClick={() =>
                                        form.setValue(
                                          `items.${index}.quantity`,
                                          Math.max(1, currentQuantity - 1),
                                          { shouldDirty: true },
                                        )
                                      }
                                    >
                                      <Minus className="h-3.5 w-3.5 stroke-[3]" />
                                    </Button>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={maxQuantity || undefined}
                                      className="h-8 border-0 text-center shadow-none focus-visible:ring-0"
                                      {...form.register(`items.${index}.quantity`)}
                                      onFocus={(e) => e.target.select()}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-lg bg-secondary/50 text-secondary-foreground hover:bg-secondary"
                                      disabled={maxQuantity > 0 ? currentQuantity >= maxQuantity : false}
                                      onClick={() =>
                                        form.setValue(`items.${index}.quantity`, currentQuantity + 1, {
                                          shouldDirty: true,
                                        })
                                      }
                                    >
                                      <Plus className="h-3.5 w-3.5 stroke-[3]" />
                                    </Button>
                                  </div>
                                  <p className="text-[10px] font-medium text-muted-foreground absolute -bottom-5 left-0 right-0 text-center whitespace-nowrap">
                                    {maxQuantity > 0
                                      ? `Available: ${maxQuantity}`
                                      : "No stock"}
                                  </p>
                                </div>
                                <div className="col-span-4 min-w-0 space-y-1 sm:col-span-4 md:col-span-1">
                                  <Label className="text-[10px] uppercase text-muted-foreground md:hidden">Price</Label>
                                  <Controller
                                    control={form.control}
                                    name={`items.${index}.unitPrice`}
                                    render={({ field: { value, onChange, ref } }) => (
                                      <CurrencyInput
                                        value={value === 0 ? "" : (value as any)}
                                        placeholder="0.00"
                                        onValueChange={(values) => onChange(values.floatValue ?? 0)}
                                        getInputRef={ref}
                                      />
                                    )}
                                  />
                                </div>
                                <div className="col-span-2 min-w-0 space-y-1 sm:col-span-3 md:col-span-1">
                                  <Label className="text-[10px] uppercase text-muted-foreground md:hidden">Disc / Qty</Label>
                                  <Controller
                                    control={form.control}
                                    name={`items.${index}.discount`}
                                    render={({ field: { value, onChange, ref } }) => (
                                      <CurrencyInput
                                        value={value === 0 ? "" : (value as any)}
                                        placeholder="0.00"
                                        onValueChange={(values) => onChange(values.floatValue ?? 0)}
                                        getInputRef={ref}
                                      />
                                    )}
                                  />
                                </div>
                                <div className="col-span-2 min-w-0 space-y-1 sm:col-span-3 md:col-span-1">
                                  <Label className="text-[10px] uppercase text-muted-foreground md:hidden">Fixed Disc</Label>
                                  <Controller
                                    control={form.control}
                                    name={`items.${index}.fixedDiscount`}
                                    render={({ field: { value, onChange, ref } }) => (
                                      <CurrencyInput
                                        value={value === 0 ? "" : (value as any)}
                                        placeholder="0.00"
                                        onValueChange={(values) => onChange(values.floatValue ?? 0)}
                                        getInputRef={ref}
                                      />
                                    )}
                                  />
                                </div>
                                <div className="hidden items-center md:flex">
                                  {index > 0 ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-10 w-10 rounded-full text-destructive hover:bg-destructive/10"
                                      onClick={() => remove(index)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                    </div>
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
                          productId: "",
                          ownedBatchId: "",
                          quantity: 1,
                          unitPrice: 0,
                          discount: 0,
                          fixedDiscount: 0,
                        });
                      }}
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
            <CardHeader>
              <CardTitle>Receipt summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {salesVatAvailable ? (
                <Controller
                  control={form.control}
                  name="applyVat"
                  render={({ field }) => (
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4">
                      <div>
                        <p className="text-sm font-semibold">Apply VAT</p>
                        <p className="text-xs text-muted-foreground">
                          {options.taxSettings.defaultSalesVatRate}% · {options.taxSettings.salesPriceMode.toLowerCase()} prices
                        </p>
                      </div>
                      <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                    </div>
                  )}
                />
              ) : null}
              <div className="rounded-2xl bg-muted/60 p-4">
                <p className="text-sm text-muted-foreground">Gross total</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(grossTotal)}</p>
              </div>
              <div className="rounded-2xl bg-muted/60 p-4">
                <p className="text-sm text-muted-foreground">Discount total</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(discountTotal)}</p>
              </div>
              {tax.taxTreatment === "STANDARD" ? (
                <div className="rounded-2xl bg-muted/60 p-4">
                  <p className="text-sm text-muted-foreground">
                    VAT ({tax.taxRate}%) {tax.pricesIncludeTax ? "included" : "added"}
                  </p>
                  <p className="mt-2 text-xl font-semibold">{formatCurrency(tax.taxAmount)}</p>
                </div>
              ) : null}
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
        )}
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
