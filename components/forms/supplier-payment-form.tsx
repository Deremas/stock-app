"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { FormFeedback } from "@/components/forms/form-feedback";
import { createSupplierPaymentAction } from "@/lib/actions/supplier-payments";
import type { SupplierPaymentFormOptions } from "@/lib/types";
import { formatCurrency, formatDateTime, formatDateForInput } from "@/lib/utils";
import {
  supplierPaymentSchema,
  type SupplierPaymentFormInput,
  type SupplierPaymentInput,
} from "@/lib/validation/supplier-payment";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatFinanceAccountLabel } from "@/lib/finance-account-utils";

type SupplierPaymentFormProps = {
  options: SupplierPaymentFormOptions;
  initialSupplierId?: string;
};

function getDefaultValues(
  options: SupplierPaymentFormOptions,
  initialSupplierId?: string,
): SupplierPaymentFormInput {
  const defaultSupplier =
    options.suppliers.find((supplier) => supplier.id === initialSupplierId) ??
    options.suppliers[0];
  const supplierPurchases = options.outstandingPurchases.filter(
    (purchase) => purchase.supplierId === defaultSupplier?.id,
  );
  const defaultPurchase = supplierPurchases[0];

  return {
    supplierId: "",
    purchaseId: "",
    financeAccountId: "",
    settlementMode: "FULL",
    amount: defaultPurchase?.amountDue ?? 0,
    paymentDate: formatDateForInput(),
    note: "",
  };
}

export function SupplierPaymentForm({
  options,
  initialSupplierId,
}: SupplierPaymentFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = getDefaultValues(options, initialSupplierId);

  const form = useForm<SupplierPaymentFormInput, undefined, SupplierPaymentInput>({
    resolver: zodResolver(supplierPaymentSchema),
    defaultValues,
  });

  const supplierId = form.watch("supplierId");
  const purchaseId = form.watch("purchaseId");
  const settlementMode = form.watch("settlementMode");

  const supplierPurchases = useMemo(
    () => options.outstandingPurchases.filter((purchase) => purchase.supplierId === supplierId),
    [options.outstandingPurchases, supplierId],
  );

  const selectedPurchase =
    supplierPurchases.find((purchase) => purchase.id === purchaseId) ?? supplierPurchases[0];
  const availableAccounts = useMemo(
    () =>
      options.accounts.filter(
        (account) =>
          !selectedPurchase || !account.branchId || account.branchId === selectedPurchase.branchId,
      ),
    [options.accounts, selectedPurchase],
  );

  useEffect(() => {
    if (!supplierPurchases.some((purchase) => purchase.id === purchaseId)) {
      form.setValue("purchaseId", supplierPurchases[0]?.id ?? "", {
        shouldDirty: true,
      });
    }
  }, [form, purchaseId, supplierPurchases]);

  useEffect(() => {
    const financeAccountId = form.getValues("financeAccountId");

    if (financeAccountId !== "" && !availableAccounts.some((account) => account.id === financeAccountId)) {
      form.setValue("financeAccountId", "", {
        shouldDirty: true,
      });
    }
  }, [availableAccounts, form]);

  useEffect(() => {
    if (settlementMode === "FULL") {
      form.setValue("amount", selectedPurchase?.amountDue ?? 0, {
        shouldDirty: true,
      });
      return;
    }

    const currentAmount = Number(form.getValues("amount") || 0);
    if (!selectedPurchase) {
      form.setValue("amount", 0, { shouldDirty: true });
    } else if (currentAmount <= 0 || currentAmount > selectedPurchase.amountDue) {
      form.setValue("amount", selectedPurchase.amountDue, { shouldDirty: true });
    }
  }, [form, selectedPurchase, settlementMode]);

  function handleCancel() {
    setSubmitError(null);
    form.reset(defaultValues);
    createDialog?.close();
  }

  function onSubmit(values: SupplierPaymentInput) {
    startTransition(async () => {
      setSubmitError(null);
      const result = await createSupplierPaymentAction(values);

      if (!result.success) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }

      setSubmitError(null);
      toast.success(result.message);
      form.reset(getDefaultValues(options, initialSupplierId));
      router.refresh();
      createDialog?.close();
    });
  }

  if (options.suppliers.length === 0 || options.outstandingPurchases.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          There are no outstanding supplier balances to pay right now.
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
          <CardTitle>Pay supplier balance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormFeedback
            errors={form.formState.errors}
            submitError={submitError}
            showValidationSummary={form.formState.submitCount > 0}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplierId">Supplier</Label>
              <Select id="supplierId" {...form.register("supplierId")}>
                <option value="">Select supplier</option>
                {options.suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-destructive">
                {form.formState.errors.supplierId?.message}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseId">Outstanding purchase</Label>
              <Select id="purchaseId" {...form.register("purchaseId")}>
                <option value="">Select outstanding purchase</option>
                {supplierPurchases.map((purchase) => (
                  <option key={purchase.id} value={purchase.id}>
                    {purchase.purchaseNumber} | {purchase.branchName} | {formatCurrency(purchase.amountDue)}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-destructive">
                {form.formState.errors.purchaseId?.message}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier-settlementMode">Settlement mode</Label>
              <Select id="supplier-settlementMode" {...form.register("settlementMode")}>
                <option value="FULL">Full payment</option>
                <option value="PARTIAL">Partial payment</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-financeAccountId">Payment account</Label>
              <Select id="supplier-financeAccountId" {...form.register("financeAccountId")}>
                <option value="">Select account</option>
                {availableAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {formatFinanceAccountLabel(account)}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-destructive">
                {form.formState.errors.financeAccountId?.message}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier-amount">Amount</Label>
              <Controller
                control={form.control}
                name="amount"
                render={({ field: { value, onChange, ref } }) => (
                  <CurrencyInput
                    id="supplier-payment-amount"
                    value={value as any}
                    onValueChange={(values) => onChange(values.floatValue ?? 0)}
                    getInputRef={ref}
                    readOnly={settlementMode === "FULL"}
                  />
                )}
              />
              <p className="text-xs text-destructive">
                {form.formState.errors.amount?.message}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment date</Label>
              <Input id="paymentDate" type="datetime-local" {...form.register("paymentDate")} />
              <p className="text-xs text-destructive">
                {form.formState.errors.paymentDate?.message}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplier-payment-note">Note</Label>
            <Textarea id="supplier-payment-note" rows={3} {...form.register("note")} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Outstanding summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Selected purchase</p>
            <p className="mt-2 text-lg font-semibold">
              {selectedPurchase?.purchaseNumber ?? "No purchase selected"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedPurchase
                ? `${selectedPurchase.branchName} | ${formatDateTime(selectedPurchase.purchasedAt)}`
                : "Choose an outstanding purchase to pay."}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Outstanding amount</p>
            <p className="mt-2 text-3xl font-semibold">
              {formatCurrency(selectedPurchase?.amountDue ?? 0)}
            </p>
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
            <Button className="sm:flex-1" type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Post payment"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
