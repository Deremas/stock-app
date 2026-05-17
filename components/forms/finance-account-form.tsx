"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { useCreateDialog } from "@/components/tables/modal-table-page";
import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createFinanceAccountAction } from "@/lib/actions/finance-accounts";
import type { FinanceAccountFormOptions } from "@/lib/types";
import {
  financeAccountSchema,
  type FinanceAccountFormInput,
  type FinanceAccountInput,
} from "@/lib/validation/finance-account";

type FinanceAccountFormProps = {
  options: FinanceAccountFormOptions;
};

function getDefaultValues(options: FinanceAccountFormOptions): FinanceAccountFormInput {
  return {
    branchId: options.branches[0]?.id ?? "",
    type: "BANK",
    name: "",
    bankName: "",
    accountNumber: "",
    initialBalance: 0,
  };
}

export function FinanceAccountForm({ options }: FinanceAccountFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = getDefaultValues(options);

  const form = useForm<FinanceAccountFormInput, undefined, FinanceAccountInput>({
    resolver: zodResolver(financeAccountSchema),
    defaultValues,
  });

  const type = form.watch("type");
  const branchId = form.watch("branchId");
  const branchHasCashAccount = options.cashBranchIds.includes(branchId);
  const canSubmit = !(type === "CASH" && branchHasCashAccount);

  useEffect(() => {
    if (type === "CASH") {
      form.setValue("name", "Cash", { shouldDirty: true });
      form.setValue("bankName", "", { shouldDirty: true });
      form.setValue("accountNumber", "", { shouldDirty: true });
    }
  }, [form, type]);

  function handleCancel() {
    setSubmitError(null);
    form.reset(defaultValues);
    createDialog?.close();
  }

  function onSubmit(values: FinanceAccountInput) {
    startTransition(async () => {
      setSubmitError(null);
      const result = await createFinanceAccountAction(values);

      if (!result.success) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      form.reset(getDefaultValues(options));
      router.refresh();
      createDialog?.close();
    });
  }

  if (options.branches.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Assign at least one active branch before creating finance accounts.
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
          <CardTitle>New bank or cash account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormFeedback
            errors={form.formState.errors}
            submitError={submitError}
            showValidationSummary={form.formState.submitCount > 0}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="finance-account-branch">Branch</Label>
              <Select id="finance-account-branch" {...form.register("branchId")}>
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
              <Label htmlFor="finance-account-type">Account type</Label>
              <Select id="finance-account-type" {...form.register("type")}>
                <option value="BANK">Bank</option>
                <option value="CASH">Cash</option>
              </Select>
              <p className="text-xs text-destructive">
                {form.formState.errors.type?.message}
              </p>
            </div>
          </div>
          {type === "CASH" ? (
            <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
              Each branch uses one shared cash account. It will be created as <span className="font-medium text-foreground">Cash</span> for the selected branch.
            </div>
          ) : null}
          {type === "CASH" && branchHasCashAccount ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              This branch already has its cash account. Create another bank account instead.
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            {type === "BANK" ? (
              <div className="space-y-2">
                <Label htmlFor="finance-account-name">Account / person name</Label>
                <Input
                  id="finance-account-name"
                  placeholder="Abebe"
                  {...form.register("name")}
                />
                <p className="text-xs text-destructive">
                  {form.formState.errors.name?.message}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Cash account</Label>
                <Input value="Cash" readOnly />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="finance-account-initial-balance">Initial balance</Label>
              <Controller
                control={form.control}
                name="initialBalance"
                render={({ field: { value, onChange, ref } }) => (
                  <CurrencyInput
                    id="finance-account-initial-balance"
                    value={value as any}
                    onValueChange={(values) => onChange(values.floatValue ?? 0)}
                    getInputRef={ref}
                  />
                )}
              />
              <p className="text-xs text-destructive">
                {form.formState.errors.initialBalance?.message}
              </p>
            </div>
          </div>
          {type === "BANK" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="finance-account-bank-name">Bank name</Label>
                <Input
                  id="finance-account-bank-name"
                  placeholder="CBE"
                  {...form.register("bankName")}
                />
                <p className="text-xs text-destructive">
                  {form.formState.errors.bankName?.message}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="finance-account-number">Account number</Label>
                <Input
                  id="finance-account-number"
                  placeholder="10002346986787"
                  {...form.register("accountNumber")}
                />
                <p className="text-xs text-destructive">
                  {form.formState.errors.accountNumber?.message}
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Posting rule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            Saving a new account can also post an opening balance so the account starts with the
            correct current amount.
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
              {isPending ? "Saving..." : "Create account"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
