"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createSellerReturnAction } from "@/lib/actions/seller-returns";
import type { SellerReturnFormOptions } from "@/lib/types";
import { formatDateTime, formatDateForInput } from "@/lib/utils";
import {
  sellerReturnSchema,
  type SellerReturnFormInput,
} from "@/lib/validation/seller-return";

type SellerReturnFormProps = {
  options: SellerReturnFormOptions;
  userRole?: string;
  initialSellerId?: string;
  initialIntakeItemId?: string;
  initialAssignmentItemId?: string;
};

function getLinesForSelection(
  options: SellerReturnFormOptions,
  branchId: string | undefined,
  sellerId: string | undefined,
) {
  return options.lines.filter(
    (line) =>
      line.branchId === branchId &&
      (!sellerId || line.sellerId === sellerId),
  );
}

function getDefaultValues(
  options: SellerReturnFormOptions,
  initialSellerId?: string,
  initialIntakeItemId?: string,
  initialAssignmentItemId?: string,
): SellerReturnFormInput {
  // 1. Try to find a specific line matching the provided IDs
  const targetLine = options.lines.find(
    (line) =>
      (initialIntakeItemId && line.intakeItemId === initialIntakeItemId) ||
      (initialAssignmentItemId && line.assignmentItemId === initialAssignmentItemId),
  );

  // 2. Fallback to any line matching the seller, or just the first line
  const seededLine =
    targetLine ??
    options.lines.find((line) => line.sellerId === initialSellerId) ??
    options.lines[0];

  const selectedBranch =
    options.branches.find((branch) => branch.id === seededLine?.branchId) ??
    options.branches[0];
  const branchLines = options.lines.filter((line) => line.branchId === selectedBranch?.id);
  
  const selectedSellerId = initialSellerId
    ? (branchLines.find((line) => line.sellerId === initialSellerId)?.sellerId ?? "")
    : (targetLine?.sellerId ?? "");

  return {
    branchId: selectedBranch?.id ?? "",
    sellerId: selectedSellerId,
    returnDate: formatDateForInput(),
    note: "",
    items: [
      {
        lineId: targetLine?.id ?? (selectedSellerId ? (branchLines.find(l => l.sellerId === selectedSellerId)?.id ?? "") : ""),
        quantity: targetLine?.availableQty ?? 1,
      },
    ],
  };
}

export function SellerReturnForm({
  options,
  userRole,
  initialSellerId,
  initialIntakeItemId,
  initialAssignmentItemId,
}: SellerReturnFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    title: string;
    message: string;
    nextSteps: { label: string; href: string }[];
  } | null>(null);
  const defaultValues = getDefaultValues(
    options, 
    initialSellerId, 
    initialIntakeItemId, 
    initialAssignmentItemId
  );
  const hasReturnableLines = options.lines.length > 0;

  const form = useForm<SellerReturnFormInput>({
    resolver: zodResolver(sellerReturnSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const branchId = form.watch("branchId");
  const sellerId = form.watch("sellerId");
  const items = form.watch("items");
  const availableLines = getLinesForSelection(options, branchId, sellerId);
  const availableSellers = useMemo(
    () =>
      [
        ...new Map(
          options.lines
            .filter((line) => line.branchId === branchId)
            .map((line) => [
              line.sellerId,
              {
                id: line.sellerId,
                name: line.sellerName,
              },
            ]),
        ).values(),
      ].sort((left, right) => left.name.localeCompare(right.name)),
    [branchId, options.lines],
  );
  const totalQuantity = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );
  const totalToSeller = items.reduce((sum, item) => {
    const selectedLine = options.lines.find((line) => line.id === item.lineId);
    return selectedLine?.direction === "TO_PARTNER"
      ? sum + Number(item.quantity || 0)
      : sum;
  }, 0);
  const totalBackToBranch = items.reduce((sum, item) => {
    const selectedLine = options.lines.find((line) => line.id === item.lineId);
    return selectedLine?.direction === "BACK_TO_BRANCH"
      ? sum + Number(item.quantity || 0)
      : sum;
  }, 0);
  const canAppendLine =
    availableLines.filter(
      (line) => !items.some((currentItem) => currentItem.lineId === line.id),
    ).length > 0;

  useEffect(() => {
    if (availableSellers.length === 0) {
      if (sellerId) {
        form.setValue("sellerId", "", {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      return;
    }

    if (!availableSellers.some((seller) => seller.id === sellerId)) {
      // Only auto-correct if a previous valid seller became invalid (e.g. branch changed).
      // If sellerId is already "" (placeholder), keep it empty — don't auto-pick.
      form.setValue("sellerId", sellerId ? (availableSellers[0]?.id ?? "") : "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [availableSellers, form, sellerId]);

  useEffect(() => {
    // Coherence check for line validity
    items.forEach((item, index) => {
      const currentLine = availableLines.find((line) => line.id === item.lineId);
      if (!currentLine && item.lineId !== "") {
        form.setValue(`items.${index}.lineId`, "", { shouldDirty: true });
        form.setValue(`items.${index}.quantity`, 1, { shouldDirty: true });
      }
    });
  }, [availableLines, form, items]);

  function handleCancel() {
    setSubmitError(null);
    setSuccess(null);
    form.reset(getDefaultValues(options, initialSellerId));
    createDialog?.close();
  }

  function handleAppendItem() {
    const usedLineIds = new Set(items.map((item) => item.lineId));
    const nextLine = availableLines.find((line) => !usedLineIds.has(line.id));

    if (!nextLine) {
      return;
    }

    append({
      lineId: nextLine.id,
      quantity: 1,
    });
  }

  function onSubmit(values: SellerReturnFormInput) {
    startTransition(async () => {
      setSubmitError(null);
      setSuccess(null);
      const result = await createSellerReturnAction(values);

      if (!result.success) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }

      setSubmitError(null);
      setSuccess({
        title: "Return Recorded",
        message: `Successfully returned ${totalQuantity} unit(s). The stock levels have been updated accordingly.`,
        nextSteps: [
          { label: "Record Another", href: "/sellers/returns?open=1" },
          { label: "Go to Dashboard", href: "/dashboard" },
        ],
      });
      toast.success(result.message);
      form.reset(getDefaultValues(options, initialSellerId));
      router.refresh();
    });
  }

  if (!hasReturnableLines) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          There are no unsold seller lines left to return right now.
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
          <CardTitle>Record seller return</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 sm:space-y-6 sm:p-6 sm:pt-0">
          <FormFeedback
            errors={form.formState.errors}
            submitError={submitError}
            success={success}
            showValidationSummary={form.formState.submitCount > 0}
          />
          {success ? null : (
            <>
              {/* Summary description removed for simplicity */}
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
                {userRole === "ADMIN" || options.branches.length > 1 ? (
                  <div className="space-y-2">
                    <Label htmlFor="seller-return-branch">Branch</Label>
                    <Select id="seller-return-branch" {...form.register("branchId")}>
                      <option value="">Select branch</option>
                      {options.branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Branch</Label>
                    <div className="flex h-10 w-full items-center rounded-xl border border-input bg-muted px-3 py-2 text-sm text-muted-foreground ring-offset-background">
                      {options.branches.find((b) => b.id === branchId)?.name ?? "Active Branch"}
                    </div>
                    {/* Hidden input to keep branchId in form state */}
                    <input type="hidden" {...form.register("branchId")} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="seller-return-seller">Seller</Label>
                  <Select id="seller-return-seller" {...form.register("sellerId")}>
                    <option value="">Select seller</option>
                    {availableSellers.map((seller) => (
                      <option key={seller.id} value={seller.id}>
                        {seller.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seller-return-date">Return date</Label>
                  <Input
                    id="seller-return-date"
                    type="datetime-local"
                    {...form.register("returnDate")}
                  />
                </div>
              </div>
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Return lines
                  </h3>
                </div>
                <div className="space-y-2.5 sm:space-y-4">
                  {fields.map((field, index) => {
                    const selectedLine = options.lines.find((line) => line.id === items[index]?.lineId);
                    const usedLineIds = new Set(
                      items
                        .map((item, currentIndex) =>
                          currentIndex === index ? null : item.lineId,
                        )
                        .filter((lineId): lineId is string => Boolean(lineId)),
                    );
                    const selectableLines = availableLines.filter(
                      (line) => !usedLineIds.has(line.id) || line.id === items[index]?.lineId,
                    );

                    return (
                      <div
                        key={field.id}
                        className="overflow-hidden rounded-2xl border border-primary/15 bg-primary/[0.035] p-3 dark:border-primary/20 dark:bg-primary/[0.08] sm:p-4"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/85">
                            Line {index + 1}
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
                        </div>                        <div className="grid grid-cols-[1fr_80px] gap-3 sm:gap-4 md:grid-cols-[1fr_120px]">
                          <div className="space-y-2">
                            <Label className="text-xs font-medium sm:text-sm">Open line</Label>
                            <Select
                              {...form.register(`items.${index}.lineId`, {
                                onChange: (e) => {
                                  const lId = e.target.value;
                                  const line = availableLines.find(l => l.id === lId);
                                  if (line) {
                                    form.setValue(`items.${index}.quantity`, 1, { shouldDirty: true });
                                  }
                                }
                              })}
                            >
                              <option value="">Select return line</option>
                              {selectableLines.map((line) => (
                                <option key={line.id} value={line.id}>
                                  {line.productName} | {line.availableQty} open |{" "}
                                  {line.direction === "TO_PARTNER"
                                    ? "Back to seller"
                                    : "Back to branch"}
                                </option>
                              ))}
                            </Select>
                            <p className="mt-1 text-xs text-destructive">
                              {form.formState.errors.items?.[index]?.lineId?.message}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-medium sm:text-sm">Qty</Label>
                            <Input
                              type="number"
                              min={1}
                              max={selectedLine?.availableQty || undefined}
                              {...form.register(`items.${index}.quantity`)}
                            />
                            {selectedLine ? (
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                Max: {selectedLine.availableQty}
                              </p>
                            ) : null}
                            <p className="mt-1 text-xs text-destructive">
                              {form.formState.errors.items?.[index]?.quantity?.message}
                            </p>
                          </div>
                        </div>
                        {selectedLine ? (
                          <div className="mt-3 rounded-2xl bg-background/80 p-3 text-[11px] text-muted-foreground sm:text-xs">
                            <p>
                              Product:{" "}
                              <span className="font-medium text-foreground">
                                {selectedLine.productName}
                              </span>
                            </p>
                          </div>
                        ) : null}


                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canAppendLine}
                    onClick={handleAppendItem}
                  >
                    <Plus className="h-4 w-4" />
                    Add line
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle>Return summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:space-y-4 sm:p-6 sm:pt-0">
          <div className="rounded-2xl bg-muted/60 p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Lines</p>
                <p className="mt-1 text-2xl font-semibold">{fields.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total qty</p>
                <p className="mt-1 text-2xl font-semibold">{totalQuantity}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">To seller</p>
                <p className="mt-1 text-2xl font-semibold">{totalToSeller}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Back to stock</p>
                <p className="mt-1 text-2xl font-semibold">{totalBackToBranch}</p>
              </div>
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
            <Button className="sm:flex-1" type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Post return"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
