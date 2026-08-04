"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import React, { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { updateBusinessSettingsAction } from "@/lib/actions/business-settings";
import type { TaxFormSettings } from "@/lib/types";
import {
  businessSettingsSchema,
  type BusinessSettingsInput,
} from "@/lib/validation/business-settings";

function SettingToggle({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 rounded-2xl border border-border p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        {...(disabled !== undefined ? { disabled } : {})}
      />
    </div>
  );
}

export function BusinessSettingsForm({ settings }: { settings: TaxFormSettings }) {
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const form = useForm<BusinessSettingsInput>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: settings,
  });
  const vatEnabled = form.watch("vatEnabled");
  const salesVatEnabled = form.watch("salesVatEnabled");
  const purchaseVatEnabled = form.watch("purchaseVatEnabled");

  function onSubmit(values: BusinessSettingsInput) {
    setSubmitError(null);
    startTransition(async () => {
      const result = await updateBusinessSettingsAction(values);
      if (!result.success) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>VAT availability</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Controller
            control={form.control}
            name="vatEnabled"
            render={({ field }) => (
              <SettingToggle
                label="Enable VAT features"
                description="Master switch. When off, VAT is hidden and new sales and purchases post with zero tax. Historical VAT records remain unchanged."
                checked={field.value}
                onCheckedChange={(checked) => {
                  field.onChange(checked);
                  if (!checked) {
                    form.setValue("salesVatEnabled", false);
                    form.setValue("purchaseVatEnabled", false);
                  }
                }}
              />
            )}
          />
          <Controller
            control={form.control}
            name="salesVatEnabled"
            render={({ field }) => (
              <SettingToggle
                label="Apply VAT to sales"
                description="Makes the VAT checkbox available during a sale. Only transactions where it is checked receive VAT."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={!vatEnabled}
              />
            )}
          />
          <Controller
            control={form.control}
            name="purchaseVatEnabled"
            render={({ field }) => (
              <SettingToggle
                label="Apply VAT to purchases"
                description="Makes the VAT checkbox available during a purchase. Only transactions where it is checked receive VAT."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={!vatEnabled}
              />
            )}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Sales VAT</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default VAT rate (%)</Label>
              <Controller
                control={form.control}
                name="defaultSalesVatRate"
                render={({ field }) => (
                  <CurrencyInput
                    value={Number(field.value ?? 0)}
                    onValueChange={(value) => field.onChange(value.floatValue ?? 0)}
                    disabled={!vatEnabled || !salesVatEnabled}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Sale price mode</Label>
              <Select {...form.register("salesPriceMode")} disabled={!vatEnabled || !salesVatEnabled}>
                <option value="EXCLUSIVE">VAT exclusive — add VAT to prices</option>
                <option value="INCLUSIVE">VAT inclusive — extract VAT from prices</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Purchase VAT</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default VAT rate (%)</Label>
              <Controller
                control={form.control}
                name="defaultPurchaseVatRate"
                render={({ field }) => (
                  <CurrencyInput
                    value={Number(field.value ?? 0)}
                    onValueChange={(value) => field.onChange(value.floatValue ?? 0)}
                    disabled={!vatEnabled || !purchaseVatEnabled}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Purchase price mode</Label>
              <Select {...form.register("purchasePriceMode")} disabled={!vatEnabled || !purchaseVatEnabled}>
                <option value="EXCLUSIVE">VAT exclusive — add VAT to costs</option>
                <option value="INCLUSIVE">VAT inclusive — extract VAT from costs</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Input VAT treatment</Label>
              <Select {...form.register("purchaseVatTreatment")} disabled={!vatEnabled || !purchaseVatEnabled}>
                <option value="RECOVERABLE">Recoverable input VAT</option>
                <option value="NON_RECOVERABLE">Non-recoverable VAT</option>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Tax registration</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="businessTaxId">Business tax/VAT identification number</Label>
          <Input id="businessTaxId" {...form.register("businessTaxId")} placeholder="Optional" />
        </CardContent>
      </Card>

      <FormFeedback errors={form.formState.errors} submitError={submitError} showValidationSummary />
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
