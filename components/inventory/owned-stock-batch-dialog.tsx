"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adjustOwnedStockBatchAction } from "@/lib/actions/purchase-batches";
import type { OwnedStockBatchOption } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type OwnedStockBatchDialogProps = {
  open: boolean;
  branchName: string | undefined;
  productName: string | undefined;
  batches: OwnedStockBatchOption[];
  canEdit: boolean;
};

type AdjustmentDraft = {
  unitCost: string;
  sellingPrice: string;
  quantityDelta: string;
  reason: string;
};

function buildDrafts(batches: OwnedStockBatchOption[]) {
  return Object.fromEntries(
    batches.map((batch) => [
      batch.id,
      {
        unitCost: String(batch.unitCost),
        sellingPrice: String(batch.sellingPrice),
        quantityDelta: "0",
        reason: "",
      },
    ]),
  ) as Record<string, AdjustmentDraft>;
}

export function OwnedStockBatchDialog({
  open,
  branchName,
  productName,
  batches,
  canEdit,
}: OwnedStockBatchDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [drafts, setDrafts] = useState<Record<string, AdjustmentDraft>>(
    buildDrafts(batches),
  );
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDrafts(buildDrafts(batches));
  }, [batches]);

  function updateDraft(
    batchId: string,
    field: keyof AdjustmentDraft,
    value: string,
  ) {
    setDrafts((current) => ({
      ...current,
      [batchId]: {
        ...(current[batchId] ?? {
          unitCost: "0",
          sellingPrice: "0",
          quantityDelta: "0",
          reason: "",
        }),
        [field]: value,
      },
    }));
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      router.replace(pathname as Parameters<typeof router.replace>[0], {
        scroll: false,
      });
    }
  }

  function handleSave(batch: OwnedStockBatchOption) {
    const draft = drafts[batch.id];

    if (!draft) {
      return;
    }

    startTransition(async () => {
      setActiveBatchId(batch.id);

      const result = await adjustOwnedStockBatchAction({
        batchId: batch.id,
        unitCost: Number(draft.unitCost),
        sellingPrice: Number(draft.sellingPrice),
        quantityDelta: Number(draft.quantityDelta),
        reason: draft.reason,
      });

      setActiveBatchId(null);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-6xl overflow-y-auto p-0">
        <div className="border-b border-border/70 px-6 py-4">
          <DialogHeader>
            <DialogTitle>Inventory sources and adjustments</DialogTitle>
            <DialogDescription>
              {productName && branchName
                ? `${productName} in ${branchName}. Adjustments affect remaining stock and future sales only. Completed sale prices and costs stay unchanged.`
                : "Review batch prices and quantities. Every change requires a reason and is added to the adjustment report."}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-4 p-6">
          {!canEdit ? (
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
              Adjustments are read-only for your role.
            </div>
          ) : null}
          {batches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
              No remaining owned inventory batches are available.
            </div>
          ) : (
            batches.map((batch) => {
              const draft = drafts[batch.id] ?? {
                unitCost: String(batch.unitCost),
                sellingPrice: String(batch.sellingPrice),
                quantityDelta: "0",
                reason: "",
              };
              const isSaving = isPending && activeBatchId === batch.id;
              const nextUnitCost = Number(draft.unitCost);
              const nextSellingPrice = Number(draft.sellingPrice);
              const quantityDelta = Number(draft.quantityDelta);
              const hasChange =
                nextUnitCost !== batch.unitCost ||
                nextSellingPrice !== batch.sellingPrice ||
                quantityDelta !== 0;
              const resultingRemaining = batch.remainingQuantity + quantityDelta;
              const canSave =
                canEdit &&
                hasChange &&
                draft.reason.trim().length >= 3 &&
                Number.isFinite(nextUnitCost) &&
                nextUnitCost >= 0 &&
                Number.isFinite(nextSellingPrice) &&
                nextSellingPrice >= 0 &&
                Number.isInteger(quantityDelta) &&
                resultingRemaining >= 0;

              return (
                <div
                  key={batch.id}
                  className="space-y-4 rounded-2xl border border-border/70 bg-background p-4"
                >
                  <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="font-semibold">{batch.referenceNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {batch.sourceType === "PURCHASE"
                          ? "Supplier purchase"
                          : "Branch transfer"}{" "}
                        from {batch.sourceName}
                      </p>
                    </div>
                    <p>
                      Received:{" "}
                      <span className="font-medium">
                        {formatDateTime(batch.receivedAt)}
                      </span>
                    </p>
                    <p>
                      Original / adjusted quantity:{" "}
                      <span className="font-medium">
                        {batch.quantity} / {batch.adjustedQuantity}
                      </span>
                    </p>
                    <p>
                      Sold / moved / remaining:{" "}
                      <span className="font-medium">
                        {batch.soldQuantity} / {batch.transferredQuantity} /{" "}
                        {batch.remainingQuantity}
                      </span>
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor={`batch-cost-${batch.id}`}>
                        Buying price
                      </Label>
                      <Input
                        id={`batch-cost-${batch.id}`}
                        type="number"
                        min={0}
                        step="0.01"
                        disabled={!canEdit}
                        value={draft.unitCost}
                        onChange={(event) =>
                          updateDraft(batch.id, "unitCost", event.target.value)
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Current: {formatCurrency(batch.unitCost)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`batch-price-${batch.id}`}>
                        Selling price
                      </Label>
                      <Input
                        id={`batch-price-${batch.id}`}
                        type="number"
                        min={0}
                        step="0.01"
                        disabled={!canEdit}
                        value={draft.sellingPrice}
                        onChange={(event) =>
                          updateDraft(
                            batch.id,
                            "sellingPrice",
                            event.target.value,
                          )
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Current: {formatCurrency(batch.sellingPrice)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`batch-quantity-${batch.id}`}>
                        Quantity change (+/-)
                      </Label>
                      <Input
                        id={`batch-quantity-${batch.id}`}
                        type="number"
                        step={1}
                        disabled={!canEdit}
                        value={draft.quantityDelta}
                        onChange={(event) =>
                          updateDraft(
                            batch.id,
                            "quantityDelta",
                            event.target.value,
                          )
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Resulting remaining: {resultingRemaining}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`batch-reason-${batch.id}`}>Reason</Label>
                      <Input
                        id={`batch-reason-${batch.id}`}
                        maxLength={500}
                        placeholder="Count correction, supplier correction..."
                        disabled={!canEdit}
                        value={draft.reason}
                        onChange={(event) =>
                          updateDraft(batch.id, "reason", event.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      disabled={!canSave || isSaving}
                      onClick={() => handleSave(batch)}
                    >
                      {isSaving ? "Saving adjustment..." : "Save adjustment"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
