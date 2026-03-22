"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { FormFeedback } from "@/components/forms/form-feedback";
import { createSellerSettlementAction } from "@/lib/actions/seller-settlements";
import type { SellerSettlementFormOptions } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  sellerSettlementSchema,
  type SellerSettlementFormInput,
  type SellerSettlementInput,
} from "@/lib/validation/seller-settlement";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SellerSettlementFormProps = {
  options: SellerSettlementFormOptions;
  initialSellerId?: string;
};

function getDefaultValues(
  options: SellerSettlementFormOptions,
  initialSellerId?: string,
): SellerSettlementFormInput {
  const defaultSeller =
    options.sellers.find((seller) => seller.id === initialSellerId) ?? options.sellers[0];
  const sellerBalances = options.outstandingBalances.filter(
    (balance) => balance.sellerId === defaultSeller?.id,
  );
  const defaultBalance = sellerBalances[0];

  return {
    sellerId: defaultSeller?.id ?? "",
    branchId: defaultBalance?.branchId ?? "",
    financeAccountId: "",
    settlementMode: "FULL",
    amount: defaultBalance?.amountDue ?? 0,
    settlementDate: new Date().toISOString().slice(0, 16),
    note: "",
  };
}

export function SellerSettlementForm({
  options,
  initialSellerId,
}: SellerSettlementFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = getDefaultValues(options, initialSellerId);

  const form = useForm<SellerSettlementFormInput, undefined, SellerSettlementInput>({
    resolver: zodResolver(sellerSettlementSchema),
    defaultValues,
  });

  const sellerId = form.watch("sellerId");
  const branchId = form.watch("branchId");
  const settlementMode = form.watch("settlementMode");

  const sellerBalances = useMemo(
    () => options.outstandingBalances.filter((balance) => balance.sellerId === sellerId),
    [options.outstandingBalances, sellerId],
  );

  const selectedBalance =
    sellerBalances.find((balance) => balance.branchId === branchId) ?? sellerBalances[0];
  const availableAccounts = useMemo(
    () =>
      options.accounts.filter(
        (account) =>
          !selectedBalance || !account.branchId || account.branchId === selectedBalance.branchId,
      ),
    [options.accounts, selectedBalance],
  );

  useEffect(() => {
    if (!sellerBalances.some((balance) => balance.branchId === branchId)) {
      form.setValue("branchId", sellerBalances[0]?.branchId ?? "", {
        shouldDirty: true,
      });
    }
  }, [branchId, form, sellerBalances]);

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
      form.setValue("amount", selectedBalance?.amountDue ?? 0, {
        shouldDirty: true,
      });
      return;
    }

    const currentAmount = Number(form.getValues("amount") || 0);
    if (!selectedBalance) {
      form.setValue("amount", 0, { shouldDirty: true });
    } else if (currentAmount <= 0 || currentAmount > selectedBalance.amountDue) {
      form.setValue("amount", selectedBalance.amountDue, { shouldDirty: true });
    }
  }, [form, selectedBalance, settlementMode]);

  function handleCancel() {
    setSubmitError(null);
    form.reset(defaultValues);
    createDialog?.close();
  }

  function onSubmit(values: SellerSettlementInput) {
    startTransition(async () => {
      setSubmitError(null);
      const result = await createSellerSettlementAction(values);

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

  if (options.sellers.length === 0 || options.outstandingBalances.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          There are no outstanding partner payables to settle right now.
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
          <CardTitle>Pay partner payable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormFeedback
            errors={form.formState.errors}
            submitError={submitError}
            showValidationSummary={form.formState.submitCount > 0}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sellerId">Partner</Label>
              <Select id="sellerId" {...form.register("sellerId")}>
                {options.sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-destructive">
                {form.formState.errors.sellerId?.message}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branchId">Branch payable</Label>
              <Select id="branchId" {...form.register("branchId")}>
                {sellerBalances.map((balance) => (
                  <option key={balance.branchId} value={balance.branchId}>
                    {balance.branchName} | {formatCurrency(balance.amountDue)}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-destructive">
                {form.formState.errors.branchId?.message}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="seller-settlementMode">Settlement mode</Label>
              <Select id="seller-settlementMode" {...form.register("settlementMode")}>
                <option value="FULL">Full settlement</option>
                <option value="PARTIAL">Partial settlement</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="seller-financeAccountId">Payment account</Label>
              <Select id="seller-financeAccountId" {...form.register("financeAccountId")}>
                {availableAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                    {account.branchName ? ` | ${account.branchName}` : ""}
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
              <Label htmlFor="seller-amount">Amount</Label>
              <Input
                id="seller-amount"
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
              <Label htmlFor="settlementDate">Settlement date</Label>
              <Input
                id="settlementDate"
                type="datetime-local"
                {...form.register("settlementDate")}
              />
              <p className="text-xs text-destructive">
                {form.formState.errors.settlementDate?.message}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="seller-settlement-note">Note</Label>
            <Textarea id="seller-settlement-note" rows={3} {...form.register("note")} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Payable summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Selected branch</p>
            <p className="mt-2 text-lg font-semibold">
              {selectedBalance?.branchName ?? "No branch selected"}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Outstanding amount</p>
            <p className="mt-2 text-3xl font-semibold">
              {formatCurrency(selectedBalance?.amountDue ?? 0)}
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
              {isPending ? "Saving..." : "Post settlement"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
