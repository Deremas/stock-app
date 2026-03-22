"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { createCustomerPaymentAction } from "@/lib/actions/customer-payments";
import { FormFeedback } from "@/components/forms/form-feedback";
import type { CustomerPaymentFormOptions } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  customerPaymentSchema,
  type CustomerPaymentFormInput,
  type CustomerPaymentInput,
} from "@/lib/validation/customer-payment";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatFinanceAccountLabel } from "@/lib/finance-account-utils";

type CustomerPaymentFormProps = {
  options: CustomerPaymentFormOptions;
  initialCustomerId?: string;
  initialSettlementMode?: "FULL" | "PARTIAL";
};

function getDefaultValues(
  options: CustomerPaymentFormOptions,
  initialCustomerId?: string,
  initialSettlementMode: "FULL" | "PARTIAL" = "FULL",
): CustomerPaymentFormInput {
  const defaultCustomer =
    options.customers.find((customer) => customer.id === initialCustomerId) ??
    options.customers[0];
  const customerSales = options.outstandingSales.filter(
    (sale) => sale.customerId === defaultCustomer?.id,
  );
  const defaultSale = customerSales[0];

  return {
    customerId: defaultCustomer?.id ?? "",
    saleId: defaultSale?.id ?? "",
    financeAccountId: "",
    settlementMode: initialSettlementMode,
    amount: defaultSale?.amountDue ?? 0,
    paymentDate: new Date().toISOString().slice(0, 16),
    note: "",
  };
}

export function CustomerPaymentForm({
  options,
  initialCustomerId,
  initialSettlementMode = "FULL",
}: CustomerPaymentFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = getDefaultValues(
    options,
    initialCustomerId,
    initialSettlementMode,
  );

  const form = useForm<CustomerPaymentFormInput, undefined, CustomerPaymentInput>({
    resolver: zodResolver(customerPaymentSchema),
    defaultValues,
  });

  const customerId = form.watch("customerId");
  const saleId = form.watch("saleId");
  const settlementMode = form.watch("settlementMode");

  const customerSales = useMemo(
    () => options.outstandingSales.filter((sale) => sale.customerId === customerId),
    [customerId, options.outstandingSales],
  );

  const selectedSale = customerSales.find((sale) => sale.id === saleId) ?? customerSales[0];
  const availableAccounts = useMemo(
    () =>
      options.accounts.filter(
        (account) => !selectedSale || !account.branchId || account.branchId === selectedSale.branchId,
      ),
    [options.accounts, selectedSale],
  );

  useEffect(() => {
    if (!customerSales.some((sale) => sale.id === saleId)) {
      form.setValue("saleId", customerSales[0]?.id ?? "", {
        shouldDirty: true,
      });
    }
  }, [customerSales, form, saleId]);

  useEffect(() => {
    const financeAccountId = form.getValues("financeAccountId");

    if (!availableAccounts.some((account) => account.id === financeAccountId)) {
      form.setValue("financeAccountId", availableAccounts[0]?.id ?? "", {
        shouldDirty: true,
      });
    }
  }, [availableAccounts, form]);

  useEffect(() => {
    if (settlementMode === "FULL") {
      form.setValue("amount", selectedSale?.amountDue ?? 0, {
        shouldDirty: true,
      });
      return;
    }

    const currentAmount = Number(form.getValues("amount") || 0);
    if (!selectedSale) {
      form.setValue("amount", 0, { shouldDirty: true });
    } else if (currentAmount <= 0 || currentAmount > selectedSale.amountDue) {
      form.setValue("amount", selectedSale.amountDue, { shouldDirty: true });
    }
  }, [form, selectedSale, settlementMode]);

  function handleCancel() {
    setSubmitError(null);
    form.reset(defaultValues);
    createDialog?.close();
  }

  function onSubmit(values: CustomerPaymentInput) {
    startTransition(async () => {
      setSubmitError(null);
      const result = await createCustomerPaymentAction(values);

      if (!result.success) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }

      setSubmitError(null);
      toast.success(result.message);
      form.reset(
        getDefaultValues(options, initialCustomerId, initialSettlementMode),
      );
      router.refresh();
      createDialog?.close();
    });
  }

  if (options.customers.length === 0 || options.outstandingSales.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          There are no outstanding customer credit balances to settle right now.
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
          <CardTitle>Settle customer credit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormFeedback
            errors={form.formState.errors}
            submitError={submitError}
            showValidationSummary={form.formState.submitCount > 0}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customerId">Customer</Label>
              <Select id="customerId" {...form.register("customerId")}>
                {options.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-destructive">
                {form.formState.errors.customerId?.message}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="saleId">Credit sale</Label>
              <Select id="saleId" {...form.register("saleId")}>
                {customerSales.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    {sale.saleNumber} | {sale.branchName} | {formatCurrency(sale.amountDue)}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-destructive">
                {form.formState.errors.saleId?.message}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settlementMode">Settlement mode</Label>
              <Select id="settlementMode" {...form.register("settlementMode")}>
                <option value="FULL">Full settlement</option>
                <option value="PARTIAL">Partial settlement</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="financeAccountId">Payment account</Label>
              <Select id="financeAccountId" {...form.register("financeAccountId")}>
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
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                min={0.01}
                step="0.01"
                readOnly={settlementMode === "FULL"}
                {...form.register("amount")}
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
            <Label htmlFor="customer-payment-note">Note</Label>
            <Textarea id="customer-payment-note" rows={3} {...form.register("note")} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Outstanding summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Selected sale</p>
            <p className="mt-2 text-lg font-semibold">
              {selectedSale?.saleNumber ?? "No sale selected"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedSale
                ? `${selectedSale.branchName} | ${formatDateTime(selectedSale.soldAt)}`
                : "Choose a credit sale to settle."}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Outstanding amount</p>
            <p className="mt-2 text-3xl font-semibold">
              {formatCurrency(selectedSale?.amountDue ?? 0)}
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
