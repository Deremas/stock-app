"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { updatePurchaseBatchSellingPriceAction } from "@/lib/actions/purchase-batches";
import { formatCurrency, formatDateTime } from "@/lib/utils";
function buildDraftPrices(batches) {
    return Object.fromEntries(batches.map((batch) => [batch.id, String(batch.sellingPrice)]));
}
export function OwnedStockBatchDialog({ open, branchName, productName, batches, canEdit, }) {
    const router = useRouter();
    const pathname = usePathname();
    const [draftPrices, setDraftPrices] = useState(buildDraftPrices(batches));
    const [activeBatchId, setActiveBatchId] = useState(null);
    const [isPending, startTransition] = useTransition();
    useEffect(() => {
        setDraftPrices(buildDraftPrices(batches));
    }, [batches]);
    function handleClose(nextOpen) {
        if (!nextOpen) {
            router.replace(pathname, {
                scroll: false,
            });
        }
    }
    function handleSave(batch) {
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
    return (_jsx(Dialog, { open: open, onOpenChange: handleClose, children: _jsxs(DialogContent, { className: "max-h-[90vh] max-w-5xl overflow-y-auto p-0", children: [_jsx("div", { className: "border-b border-border/70 px-6 py-4", children: _jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Remaining batches" }), _jsx(DialogDescription, { children: productName && branchName
                                    ? `${productName} in ${branchName}. Updating a batch price affects only the unsold remaining quantity.`
                                    : "Review or update batch selling prices for the remaining owned quantity." })] }) }), _jsxs("div", { className: "space-y-4 p-6", children: [!canEdit ? (_jsx("div", { className: "rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground", children: "Batch prices are read-only for your role. Ask an admin if a remaining lot needs a selling price update." })) : null, batches.length === 0 ? (_jsx("div", { className: "rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground", children: "No remaining owned batches are available for this item in this branch." })) : (batches.map((batch) => {
                            const currentDraft = draftPrices[batch.id] ?? String(batch.sellingPrice);
                            const isSaving = isPending && activeBatchId === batch.id;
                            const normalizedDraft = Number(currentDraft);
                            const isChanged = Number.isFinite(normalizedDraft) &&
                                normalizedDraft !== batch.sellingPrice;
                            return (_jsx("div", { className: "rounded-2xl border border-border/70 bg-background p-4", children: _jsxs("div", { className: "grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold", children: batch.referenceNumber }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [batch.sourceType === "PURCHASE" ? "Received from supplier" : "Received from branch", " ", batch.sourceName, " on ", formatDateTime(batch.receivedAt)] })] }), _jsxs("div", { className: "grid gap-2 text-sm sm:grid-cols-2", children: [_jsxs("p", { children: ["Purchased Qty: ", _jsx("span", { className: "font-medium", children: batch.quantity })] }), _jsxs("p", { children: ["Sold Qty: ", _jsx("span", { className: "font-medium", children: batch.soldQuantity })] }), _jsxs("p", { children: ["Moved Out:", " ", _jsx("span", { className: "font-medium", children: batch.transferredQuantity })] }), _jsxs("p", { children: ["Remaining Qty:", " ", _jsx("span", { className: "font-medium", children: batch.remainingQuantity })] }), _jsxs("p", { children: ["Buying Price:", " ", _jsx("span", { className: "font-medium", children: formatCurrency(batch.unitCost) })] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-sm font-medium", children: "Current batch selling price" }), _jsx("p", { className: "rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm", children: formatCurrency(batch.sellingPrice) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { htmlFor: `batch-price-${batch.id}`, className: "text-sm font-medium", children: "New selling price" }), _jsx(Input, { id: `batch-price-${batch.id}`, type: "number", min: 0, step: "0.01", disabled: !canEdit, value: currentDraft, onChange: (event) => setDraftPrices((current) => ({
                                                        ...current,
                                                        [batch.id]: event.target.value,
                                                    })) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Future sales can still override this per sale line." })] }), _jsx("div", { className: "flex items-end", children: _jsx(Button, { type: "button", disabled: !canEdit || isSaving || !isChanged, onClick: () => handleSave(batch), children: isSaving ? "Saving..." : "Save price" }) })] }) }, batch.id));
                        }))] })] }) }));
}
