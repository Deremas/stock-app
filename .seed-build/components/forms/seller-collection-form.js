"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { createSellerCollectionAction } from "@/lib/actions/seller-collections";
import { formatFinanceAccountLabel } from "@/lib/finance-account-utils";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { sellerCollectionSchema, } from "@/lib/validation/seller-collection";
function getLinesForSeller(options, sellerId) {
    return options.lines.filter((line) => !sellerId || line.sellerId === sellerId);
}
function getDefaultValues(options, initialSellerId) {
    const seededLine = options.lines.find((line) => line.sellerId === initialSellerId) ?? options.lines[0];
    const sellerId = seededLine?.sellerId ?? "";
    const sellerLines = getLinesForSeller(options, sellerId);
    const firstLine = sellerLines[0] ?? seededLine;
    return {
        sellerId,
        branchId: firstLine?.branchId ?? "",
        financeAccountId: "",
        collectionDate: new Date().toISOString().slice(0, 16),
        note: "",
        items: [
            {
                lineId: firstLine?.id ?? "",
                amount: firstLine?.amountDue ?? 0,
            },
        ],
    };
}
export function SellerCollectionForm({ options, initialSellerId, }) {
    const createDialog = useCreateDialog();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [submitError, setSubmitError] = useState(null);
    const defaultValues = getDefaultValues(options, initialSellerId);
    const hasCollectibleLines = options.lines.length > 0;
    const form = useForm({
        resolver: zodResolver(sellerCollectionSchema),
        defaultValues,
    });
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    });
    const sellerId = form.watch("sellerId");
    const branchId = form.watch("branchId");
    const items = form.watch("items");
    const availableLines = useMemo(() => getLinesForSeller(options, sellerId), [options, sellerId]);
    const availableAccounts = useMemo(() => options.accounts.filter((account) => !branchId || !account.branchId || account.branchId === branchId), [branchId, options.accounts]);
    const branchName = availableLines[0]?.branchName ?? "No branch selected";
    const totalAmount = Number(items.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2));
    const totalQuantity = items.reduce((sum, item) => {
        const selectedLine = options.lines.find((line) => line.id === item.lineId);
        return sum + (selectedLine?.quantity ?? 0);
    }, 0);
    const uniqueSales = new Set(items
        .map((item) => options.lines.find((line) => line.id === item.lineId)?.saleNumber)
        .filter((saleNumber) => Boolean(saleNumber)));
    const canAppendLine = availableLines.filter((line) => !items.some((currentItem) => currentItem.lineId === line.id)).length > 0;
    useEffect(() => {
        if (options.sellers.length === 0) {
            return;
        }
        if (!options.sellers.some((seller) => seller.id === sellerId)) {
            form.setValue("sellerId", options.sellers[0]?.id ?? "", {
                shouldDirty: true,
                shouldValidate: true,
            });
        }
    }, [form, options.sellers, sellerId]);
    useEffect(() => {
        const nextBranchId = availableLines[0]?.branchId ?? "";
        if (branchId !== nextBranchId) {
            form.setValue("branchId", nextBranchId, {
                shouldDirty: true,
                shouldValidate: true,
            });
        }
    }, [availableLines, branchId, form]);
    useEffect(() => {
        const financeAccountId = form.getValues("financeAccountId");
        if (!availableAccounts.some((account) => account.id === financeAccountId)) {
            form.setValue("financeAccountId", availableAccounts[0]?.id ?? "", {
                shouldDirty: true,
                shouldValidate: true,
            });
        }
    }, [availableAccounts, form]);
    useEffect(() => {
        const selectedLineIds = items.map((item) => item.lineId);
        items.forEach((item, index) => {
            const currentLine = availableLines.find((line) => line.id === item.lineId);
            const fallbackLine = availableLines.find((line) => !selectedLineIds.some((lineId, currentIndex) => currentIndex !== index && lineId === line.id)) ?? currentLine ?? availableLines[0];
            const nextLine = currentLine ?? fallbackLine;
            const nextLineId = nextLine?.id ?? "";
            if (item.lineId !== nextLineId) {
                form.setValue(`items.${index}.lineId`, nextLineId, {
                    shouldDirty: true,
                    shouldValidate: true,
                });
            }
            const maxAmount = Number((nextLine?.amountDue ?? 0).toFixed(2));
            const currentAmount = Number(item.amount || 0);
            const normalizedAmount = maxAmount <= 0
                ? 0
                : currentAmount <= 0 || currentAmount > maxAmount
                    ? maxAmount
                    : Number(currentAmount.toFixed(2));
            if (currentAmount !== normalizedAmount) {
                form.setValue(`items.${index}.amount`, normalizedAmount, {
                    shouldDirty: true,
                    shouldValidate: true,
                });
            }
        });
    }, [availableLines, form, items]);
    function handleCancel() {
        setSubmitError(null);
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
            amount: nextLine.amountDue,
        });
    }
    function onSubmit(values) {
        startTransition(async () => {
            setSubmitError(null);
            const result = await createSellerCollectionAction(values);
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
    if (!hasCollectibleLines) {
        return (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "There are no sold assigned lines waiting for collection right now." }), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { type: "button", variant: "outline", onClick: () => createDialog?.close(), children: "Close" }) })] }));
    }
    return (_jsxs("form", { className: "grid gap-3 sm:gap-6 xl:grid-cols-[2fr_1fr]", onChangeCapture: () => {
            if (submitError) {
                setSubmitError(null);
            }
        }, onSubmit: form.handleSubmit(onSubmit), children: [_jsx("input", { type: "hidden", ...form.register("branchId") }), _jsx("input", { type: "hidden", ...form.register("note") }), _jsxs(Card, { children: [_jsx(CardHeader, { className: "p-4 sm:p-6", children: _jsx(CardTitle, { children: "Collect sold assigned items" }) }), _jsxs(CardContent, { className: "space-y-4 p-4 pt-0 sm:space-y-6 sm:p-6 sm:pt-0", children: [_jsx(FormFeedback, { errors: form.formState.errors, submitError: submitError, showValidationSummary: form.formState.submitCount > 0 }), _jsx("div", { className: "rounded-2xl border border-primary/15 bg-primary/[0.035] p-3 text-sm text-muted-foreground sm:p-4", children: "Select exact sold lines to collect from the partner. This page is only for items we issued from branch stock. Unsold assigned items return from the Returns page." }), _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "seller-collection-seller", children: "Partner" }), _jsx(Select, { id: "seller-collection-seller", ...form.register("sellerId"), children: options.sellers.map((seller) => (_jsx("option", { value: seller.id, children: seller.name }, seller.id))) }), form.formState.errors.sellerId?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.sellerId.message })) : null] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "seller-collection-account", children: "Receiving account" }), _jsx(Select, { id: "seller-collection-account", ...form.register("financeAccountId"), children: availableAccounts.map((account) => (_jsx("option", { value: account.id, children: formatFinanceAccountLabel(account) }, account.id))) }), form.formState.errors.financeAccountId?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.financeAccountId.message })) : null] })] }), _jsxs("div", { className: "grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.7fr)]", children: [_jsxs("div", { className: "rounded-2xl bg-muted/55 p-3 sm:p-4", children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Branch" }), _jsx("p", { className: "mt-1 text-lg font-semibold", children: branchName })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "seller-collection-date", children: "Collection date" }), _jsx(Input, { id: "seller-collection-date", type: "datetime-local", ...form.register("collectionDate") }), form.formState.errors.collectionDate?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.collectionDate.message })) : null] })] }), _jsxs("div", { className: "space-y-3 sm:space-y-4", children: [_jsx("div", { className: "flex flex-wrap items-center justify-between gap-2", children: _jsx("h3", { className: "text-sm font-semibold uppercase tracking-wide text-muted-foreground", children: "Sold lines" }) }), _jsx("div", { className: "space-y-2.5 sm:space-y-4", children: fields.map((field, index) => {
                                            const selectedLine = options.lines.find((line) => line.id === items[index]?.lineId);
                                            const usedLineIds = new Set(items
                                                .map((item, currentIndex) => currentIndex === index ? null : item.lineId)
                                                .filter((lineId) => Boolean(lineId)));
                                            const selectableLines = availableLines.filter((line) => !usedLineIds.has(line.id) || line.id === items[index]?.lineId);
                                            return (_jsxs("div", { className: "rounded-2xl border border-primary/15 bg-primary/[0.035] p-3 dark:border-primary/20 dark:bg-primary/[0.08] sm:p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between gap-3", children: [_jsxs("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/85", children: ["Line ", index + 1] }), fields.length > 1 ? (_jsxs(Button, { type: "button", variant: "outline", size: "icon", className: "h-8 w-8 shrink-0 rounded-lg border-destructive/35 bg-background/80 text-destructive shadow-sm hover:bg-destructive/10 hover:text-destructive", onClick: () => remove(index), children: [_jsx(Trash2, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: "Remove line" })] })) : null] }), _jsxs("div", { className: "grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(130px,1fr)]", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-xs font-medium sm:text-sm", children: "Sold line" }), _jsxs(Select, { ...form.register(`items.${index}.lineId`), children: [_jsx("option", { value: "", children: "Select sold line" }), selectableLines.map((line) => (_jsxs("option", { value: line.id, children: [line.productName, " | ", line.saleNumber, " | ", line.quantity, " sold |", " ", formatCurrency(line.amountDue)] }, line.id)))] }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items?.[index]?.lineId?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-xs font-medium sm:text-sm", children: "Amount" }), _jsx(Input, { type: "number", min: 0.01, max: selectedLine?.amountDue || undefined, step: "0.01", ...form.register(`items.${index}.amount`) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items?.[index]?.amount?.message })] })] }), selectedLine ? (_jsxs("div", { className: "mt-3 rounded-2xl bg-background/80 p-3 text-[11px] text-muted-foreground sm:text-xs", children: [_jsxs("p", { children: ["Item:", " ", _jsx("span", { className: "font-medium text-foreground", children: selectedLine.productName })] }), _jsxs("p", { className: "mt-1", children: ["Sale:", " ", _jsx("span", { className: "font-medium text-foreground", children: selectedLine.saleNumber }), " ", "on ", formatDateTime(selectedLine.soldAt)] }), _jsxs("p", { className: "mt-1", children: ["Sold qty:", " ", _jsx("span", { className: "font-medium text-foreground", children: selectedLine.quantity })] }), _jsxs("p", { className: "mt-1", children: ["Still due:", " ", _jsx("span", { className: "font-medium text-foreground", children: formatCurrency(selectedLine.amountDue) })] })] })) : null] }, field.id));
                                        }) }), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "button", variant: "outline", size: "sm", disabled: !canAppendLine, onClick: handleAppendItem, children: [_jsx(Plus, { className: "h-4 w-4" }), "Add line"] }) })] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { className: "p-4 sm:p-6", children: _jsx(CardTitle, { children: "Collection summary" }) }), _jsxs(CardContent, { className: "space-y-3 p-4 pt-0 sm:space-y-4 sm:p-6 sm:pt-0", children: [_jsx("div", { className: "rounded-2xl bg-muted/60 p-3 sm:p-4", children: _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Lines" }), _jsx("p", { className: "mt-1 text-2xl font-semibold", children: fields.length })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Sold qty" }), _jsx("p", { className: "mt-1 text-2xl font-semibold", children: totalQuantity })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Sales" }), _jsx("p", { className: "mt-1 text-2xl font-semibold", children: uniqueSales.size })] })] }) }), _jsxs("div", { className: "rounded-2xl bg-muted/60 p-3 sm:p-4", children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Total collection" }), _jsx("p", { className: "mt-1 text-3xl font-semibold", children: formatCurrency(totalAmount) })] }), _jsx("div", { className: "rounded-2xl bg-muted/60 p-3 text-sm text-muted-foreground sm:p-4", children: "Collect only sold assigned lines here. Unsold assigned quantities should be posted from Returns so they move back into branch stock instead of staying open with the partner." }), _jsxs("div", { className: "flex flex-col-reverse gap-2 sm:flex-row", children: [_jsx(Button, { type: "button", variant: "outline", className: "sm:flex-1", disabled: isPending, onClick: handleCancel, children: "Cancel" }), _jsx(Button, { className: "sm:flex-1", type: "submit", disabled: isPending, children: isPending ? "Saving..." : "Post collection" })] })] })] })] }));
}
