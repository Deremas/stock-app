"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { useCreateDialog } from "@/components/tables/modal-table-page";
import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createCashTransferAction } from "@/lib/actions/cash-transfers";
import { formatFinanceAccountLabel } from "@/lib/finance-account-utils";
import type { CashTransferFormOptions } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  cashTransferSchema,
  type CashTransferFormInput,
  type CashTransferInput,
} from "@/lib/validation/cash-transfer";

type CashTransferFormProps = {
  options: CashTransferFormOptions;
  initialCashAccountId?: string;
};

function getDefaultValues(
  options: CashTransferFormOptions,
  initialCashAccountId?: string,
): CashTransferFormInput {
  const selectedCashAccount =
    options.cashAccounts.find((account) => account.id === initialCashAccountId) ??
    options.cashAccounts[0];
  const branchId = selectedCashAccount?.branchId ?? options.branches[0]?.id ?? "";
  const branchBankAccount =
    options.bankAccounts.find((account) => account.branchId === branchId) ??
    options.bankAccounts[0];

  return {
    branchId,
    fromAccountId: selectedCashAccount?.id ?? "",
    toAccountId: branchBankAccount?.id ?? "",
    amount: 0,
    transferDate: new Date().toISOString().slice(0, 16),
    note: "",
  };
}

export function CashTransferForm({
  options,
  initialCashAccountId,
}: CashTransferFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = getDefaultValues(options, initialCashAccountId);

  const form = useForm<CashTransferFormInput, undefined, CashTransferInput>({
    resolver: zodResolver(cashTransferSchema),
    defaultValues,
  });

  const branchId = form.watch("branchId");
  const fromAccountId = form.watch("fromAccountId");

  const cashAccounts = useMemo(
    () => options.cashAccounts.filter((account) => account.branchId === branchId),
    [branchId, options.cashAccounts],
  );
  const bankAccounts = useMemo(
    () => options.bankAccounts.filter((account) => account.branchId === branchId),
    [branchId, options.bankAccounts],
  );
  const selectedCashAccount =
    cashAccounts.find((account) => account.id === fromAccountId) ?? cashAccounts[0];

  useEffect(() => {
    if (!cashAccounts.some((account) => account.id === fromAccountId)) {
      form.setValue("fromAccountId", cashAccounts[0]?.id ?? "", {
        shouldDirty: true,
      });
    }
  }, [cashAccounts, form, fromAccountId]);

  useEffect(() => {
    const toAccountId = form.getValues("toAccountId");

    if (!bankAccounts.some((account) => account.id === toAccountId)) {
      form.setValue("toAccountId", bankAccounts[0]?.id ?? "", {
        shouldDirty: true,
      });
    }
  }, [bankAccounts, form]);

  useEffect(() => {
    const amount = Number(form.getValues("amount") || 0);
    const maxAmount = selectedCashAccount?.balance ?? 0;

    if (amount > maxAmount) {
      form.setValue("amount", maxAmount, { shouldDirty: true });
    }
  }, [form, selectedCashAccount]);

  function handleCancel() {
    setSubmitError(null);
    form.reset(getDefaultValues(options, initialCashAccountId));
    createDialog?.close();
  }

  function onSubmit(values: CashTransferInput) {
    startTransition(async () => {
      setSubmitError(null);
      const result = await createCashTransferAction(values);

      if (!result.success) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      form.reset(getDefaultValues(options, initialCashAccountId));
      router.refresh();
      createDialog?.close();
    });
  }

  if (options.cashAccounts.length === 0 || options.bankAccounts.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Create at least one cash account and one bank account before posting a deposit.
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
          <CardTitle>Deposit cash to bank</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormFeedback
            errors={form.formState.errors}
            submitError={submitError}
            showValidationSummary={form.formState.submitCount > 0}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cash-transfer-branch">Branch</Label>
              <Select id="cash-transfer-branch" {...form.register("branchId")}>
                {options.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} - {branch.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-destructive">
                {form.formState.errors.branchId?.message}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cash-transfer-date">Transfer date</Label>
              <Input
                id="cash-transfer-date"
                type="datetime-local"
                {...form.register("transferDate")}
              />
              <p className="text-xs text-destructive">
                {form.formState.errors.transferDate?.message}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cash-transfer-from">Cash account</Label>
              <Select id="cash-transfer-from" {...form.register("fromAccountId")}>
                {cashAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {formatFinanceAccountLabel(account)} | {formatCurrency(account.balance)}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-destructive">
                {form.formState.errors.fromAccountId?.message}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cash-transfer-to">Bank account</Label>
              <Select id="cash-transfer-to" {...form.register("toAccountId")}>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {formatFinanceAccountLabel(account)}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-destructive">
                {form.formState.errors.toAccountId?.message}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cash-transfer-amount">Amount</Label>
              <Input
                id="cash-transfer-amount"
                type="number"
                min={0.01}
                max={selectedCashAccount?.balance ?? undefined}
                step="0.01"
                {...form.register("amount")}
              />
              <p className="text-xs text-destructive">
                {form.formState.errors.amount?.message}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cash-transfer-note">Note</Label>
              <Textarea id="cash-transfer-note" rows={3} {...form.register("note")} />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Available cash</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Selected cash balance</p>
            <p className="mt-2 text-3xl font-semibold">
              {formatCurrency(selectedCashAccount?.balance ?? 0)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            Deposits post two ledger entries: cash is credited and the destination bank account is
            debited by the same amount.
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
              {isPending ? "Saving..." : "Post deposit"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
