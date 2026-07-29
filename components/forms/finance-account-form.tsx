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
import { Switch } from "@/components/ui/switch";
import { createFinanceAccountAction, updateFinanceAccountAction } from "@/lib/actions/finance-accounts";
import type { FinanceAccountFormOptions } from "@/lib/types";
import {
  financeAccountSchema,
  type FinanceAccountFormInput,
  type FinanceAccountInput,
} from "@/lib/validation/finance-account";

type FinanceAccountFormProps = {
  options: FinanceAccountFormOptions;
  account?: {
    id: string;
    type: "BANK" | "CASH";
    name: string;
    bankName: string | null;
    accountNumber: string | null;
    isActive: boolean;
  };
};

function getDefaultValues(
  account?: FinanceAccountFormProps["account"],
): FinanceAccountFormInput {
  return {
    branchId: "",
    type: account?.type ?? "BANK",
    name: account?.name ?? "",
    bankName: account?.bankName ?? "",
    accountNumber: account?.accountNumber ?? "",
    initialBalance: 0,
    isActive: account?.isActive ?? true,
  };
}

export function FinanceAccountForm({ options, account }: FinanceAccountFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = getDefaultValues(account);
  const isEditing = !!account;

  const form = useForm<
    FinanceAccountFormInput,
    undefined,
    FinanceAccountInput
  >({
    resolver: zodResolver(financeAccountSchema),
    defaultValues,
  });

  const type = form.watch("type");
  const hasGlobalCash = options.hasGlobalCash;
  const canSubmit = isEditing || !(type === "CASH" && hasGlobalCash);

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
      let result;
      if (isEditing && account) {
        result = await updateFinanceAccountAction(account.id, {
          branchId: "",
          type: values.type,
          name: values.name,
          bankName: values.bankName,
          accountNumber: values.accountNumber,
          isActive: values.isActive,
        });
      } else {
        result = await createFinanceAccountAction(values);
      }

      if (!result.success) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      form.reset(getDefaultValues());
      router.refresh();
      createDialog?.close();
    });
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
          <CardTitle>{isEditing ? "Edit finance account" : "New bank or cash account"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormFeedback
            errors={form.formState.errors}
            submitError={submitError}
            showValidationSummary={form.formState.submitCount > 0}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="finance-account-type">Account type</Label>
              <Select id="finance-account-type" {...form.register("type")} disabled={isEditing}>
                <option value="BANK">Bank</option>
                <option value="CASH">Cash</option>
              </Select>
              <p className="text-xs text-destructive">
                {form.formState.errors.type?.message}
              </p>
            </div>
            {isEditing && (
              <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                <div className="space-y-0.5">
                  <Label htmlFor="finance-account-active">Active status</Label>
                  <p className="text-xs text-muted-foreground">Toggle availability</p>
                </div>
                <Controller
                  control={form.control}
                  name="isActive"
                  render={({ field: { value, onChange } }) => (
                    <Switch
                      id="finance-account-active"
                      checked={value ?? true}
                      onCheckedChange={onChange}
                    />
                  )}
                />
              </div>
            )}
          </div>
          {!isEditing && type === "CASH" ? (
            <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
              A single global cash account will be created.
            </div>
          ) : null}
          {!isEditing && type === "CASH" && hasGlobalCash ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              A global cash account already exists. You cannot create another.
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
            {!isEditing && (
              <div className="space-y-2">
                <Label htmlFor="finance-account-initial-balance">Initial balance</Label>
                <Controller
                  control={form.control}
                  name="initialBalance"
                  render={({ field: { value, onChange, ref } }) => (
                    <CurrencyInput
                      id="finance-account-initial-balance"
                      value={typeof value === "number" ? value : 0}
                      onValueChange={(values) => onChange(values.floatValue ?? 0)}
                      getInputRef={ref}
                    />
                  )}
                />
                <p className="text-xs text-destructive">
                  {form.formState.errors.initialBalance?.message}
                </p>
              </div>
            )}
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
            {isEditing
              ? "Saving changes updates account info. Direct ledger entries are unmodified."
              : "Saving a new account can also post an opening balance so the account starts with the correct current amount."}
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
              {isPending ? "Saving..." : isEditing ? "Save changes" : "Create account"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
