"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { createExpenseAction } from "@/lib/actions/expenses";
import { formatFinanceAccountLabel } from "@/lib/finance-account-utils";
import type { ExpenseFormOptions } from "@/lib/types";
import { formatDateForInput } from "@/lib/utils";
import {
  expenseSchema,
  type ExpenseFormInput,
  type ExpenseInput,
} from "@/lib/validation/expense";

type ExpenseFormProps = {
  options: ExpenseFormOptions;
};

function getDefaultValues(options: ExpenseFormOptions): ExpenseFormInput {
  return {
    branchId: options.branches[0]?.id ?? "",
    financeAccountId: "",
    categoryName: "",
    name: "",
    amount: 0,
    expenseDate: formatDateForInput(),
    note: "",
  };
}

export function ExpenseForm({ options }: ExpenseFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = getDefaultValues(options);

  const form = useForm<ExpenseFormInput, undefined, ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues,
  });

  const branchId = form.watch("branchId");
  const availableAccounts = useMemo(
    () => options.accounts.filter((account) => account.branchId === branchId),
    [branchId, options.accounts],
  );

  useEffect(() => {
    const financeAccountId = form.getValues("financeAccountId");

    const newValue = availableAccounts[0]?.id ?? "";
    if (financeAccountId !== newValue && !availableAccounts.some((account) => account.id === financeAccountId)) {
      form.setValue("financeAccountId", newValue, {
        shouldDirty: true,
      });
    }
  }, [availableAccounts, form]);

  function handleCancel() {
    setSubmitError(null);
    form.reset(defaultValues);
    createDialog?.close();
  }

  function onSubmit(values: ExpenseInput) {
    startTransition(async () => {
      setSubmitError(null);
      const result = await createExpenseAction(values);

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

  if (options.branches.length === 0 || options.accounts.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Create a branch payment account before recording expenses.
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
          <CardTitle>New expense</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormFeedback
            errors={form.formState.errors}
            submitError={submitError}
            showValidationSummary={form.formState.submitCount > 0}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expense-branch">Branch</Label>
              {options.branches.length > 1 ? (
                <Select id="expense-branch" {...form.register("branchId")}>
                  <option value="">Select branch</option>
                  {options.branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} - {branch.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <>
                  <div className="flex h-10 w-full items-center rounded-xl border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {options.branches[0]?.name ?? "No branch"}
                  </div>
                  <input type="hidden" {...form.register("branchId")} />
                </>
              )}
              <p className="text-xs text-destructive">
                {form.formState.errors.branchId?.message}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-date">Expense date</Label>
              <Input id="expense-date" type="datetime-local" {...form.register("expenseDate")} />
              <p className="text-xs text-destructive">
                {form.formState.errors.expenseDate?.message}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expense-account">Payment account</Label>
              <Select id="expense-account" {...form.register("financeAccountId")}>
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
            <div className="space-y-2">
              <Label htmlFor="expense-amount">Amount</Label>
              <Controller
                control={form.control}
                name="amount"
                render={({ field: { value, onChange, ref } }) => (
                  <CurrencyInput
                    id="expense-amount"
                    value={value as any}
                    onValueChange={(values) => onChange(values.floatValue ?? 0)}
                    getInputRef={ref}
                  />
                )}
              />
              <p className="text-xs text-destructive">
                {form.formState.errors.amount?.message}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expense-category">Category</Label>
              <Input
                id="expense-category"
                list="expense-category-list"
                placeholder="Transport, Rent, Utilities..."
                {...form.register("categoryName")}
              />
              <datalist id="expense-category-list">
                {options.categoryNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <p className="text-xs text-destructive">
                {form.formState.errors.categoryName?.message}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-name">Expense name</Label>
              <Input
                id="expense-name"
                placeholder="Fuel, loading, lunch..."
                {...form.register("name")}
              />
              <p className="text-xs text-destructive">
                {form.formState.errors.name?.message}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-note">Note</Label>
            <Textarea id="expense-note" rows={3} {...form.register("note")} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Category tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category tracking descriptions removed for simplicity */}
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
              {isPending ? "Saving..." : "Post expense"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
