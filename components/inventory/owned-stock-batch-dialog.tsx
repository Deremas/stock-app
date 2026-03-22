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
import { updatePurchaseBatchSellingPriceAction } from "@/lib/actions/purchase-batches";
import type { OwnedStockBatchOption } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type OwnedStockBatchDialogProps = {
  open: boolean;
  branchName: string | undefined;
  productName: string | undefined;
  batches: OwnedStockBatchOption[];
  canEdit: boolean;
};

function buildDraftPrices(batches: OwnedStockBatchOption[]) {
  return Object.fromEntries(
    batches.map((batch) => [batch.id, String(batch.sellingPrice)]),
  ) as Record<string, string>;
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
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>(
    buildDraftPrices(batches),
  );
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDraftPrices(buildDraftPrices(batches));
  }, [batches]);

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      router.replace(pathname as Parameters<typeof router.replace>[0], {
        scroll: false,
      });
    }
  }

  function handleSave(batch: OwnedStockBatchOption) {
    const nextValue = Number(draftPrices[batch.id] ?? batch.sellingPrice);

    startTransition(async () => {
      setActiveBatchId(batch.id);

      const result = await updatePurchaseBatchSellingPriceAction({
        batchId: batch.id,
        sellingPrice: nextValue,
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
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto p-0">
        <div className="border-b border-border/70 px-6 py-4">
          <DialogHeader>
            <DialogTitle>Remaining batches</DialogTitle>
            <DialogDescription>
              {productName && branchName
              ? `${productName} in ${branchName}. Updating a batch price affects only the unsold remaining quantity.`
                : "Review or update batch selling prices for the remaining owned quantity."}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-4 p-6">
          {!canEdit ? (
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
              Batch prices are read-only for your role. Ask an admin if a remaining lot
              needs a selling price update.
            </div>
          ) : null}
          {batches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
              No remaining owned purchase batches are available for this item in this branch.
            </div>
          ) : (
            batches.map((batch) => {
              const currentDraft = draftPrices[batch.id] ?? String(batch.sellingPrice);
              const isSaving = isPending && activeBatchId === batch.id;
              const normalizedDraft = Number(currentDraft);
              const isChanged =
                Number.isFinite(normalizedDraft) &&
                normalizedDraft !== batch.sellingPrice;

              return (
                <div
                  key={batch.id}
                  className="rounded-2xl border border-border/70 bg-background p-4"
                >
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold">
                          {batch.referenceNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {batch.sourceType === "PURCHASE" ? "Received from supplier" : "Received from branch"}{" "}
                          {batch.sourceName} on {formatDateTime(batch.receivedAt)}
                        </p>
                      </div>
                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        <p>
                          Purchased Qty: <span className="font-medium">{batch.quantity}</span>
                        </p>
                        <p>
                          Sold Qty: <span className="font-medium">{batch.soldQuantity}</span>
                        </p>
                        <p>
                          Moved Out:{" "}
                          <span className="font-medium">{batch.transferredQuantity}</span>
                        </p>
                        <p>
                          Remaining Qty:{" "}
                          <span className="font-medium">{batch.remainingQuantity}</span>
                        </p>
                        <p>
                          Buying Price:{" "}
                          <span className="font-medium">
                            {formatCurrency(batch.unitCost)}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Current batch selling price</p>
                      <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
                        {formatCurrency(batch.sellingPrice)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor={`batch-price-${batch.id}`}
                        className="text-sm font-medium"
                      >
                        New selling price
                      </label>
                      <Input
                        id={`batch-price-${batch.id}`}
                        type="number"
                        min={0}
                        step="0.01"
                        disabled={!canEdit}
                        value={currentDraft}
                        onChange={(event) =>
                          setDraftPrices((current) => ({
                            ...current,
                            [batch.id]: event.target.value,
                          }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Future sales can still override this per sale line.
                      </p>
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        disabled={!canEdit || isSaving || !isChanged}
                        onClick={() => handleSave(batch)}
                      >
                        {isSaving ? "Saving..." : "Save price"}
                      </Button>
                    </div>
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
