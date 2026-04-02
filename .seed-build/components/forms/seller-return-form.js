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
import { createSellerReturnAction } from "@/lib/actions/seller-returns";
import { formatDateTime } from "@/lib/utils";
import { sellerReturnSchema, } from "@/lib/validation/seller-return";
function getLinesForSelection(options, branchId, sellerId) {
    return options.lines.filter((line) => line.branchId === branchId &&
        (!sellerId || line.sellerId === sellerId));
}
function getDefaultValues(options, initialSellerId) {
    const seededLine = options.lines.find((line) => line.sellerId === initialSellerId) ?? options.lines[0];
    const selectedBranch = options.branches.find((branch) => branch.id === seededLine?.branchId) ??
        options.branches[0];
    const branchLines = options.lines.filter((line) => line.branchId === selectedBranch?.id);
    const selectedSellerId = branchLines.find((line) => line.sellerId === initialSellerId)?.sellerId ??
        branchLines[0]?.sellerId ??
        "";
    const sellerLines = branchLines.filter((line) => line.sellerId === selectedSellerId);
    return {
        branchId: selectedBranch?.id ?? "",
        sellerId: selectedSellerId,
        returnDate: new Date().toISOString().slice(0, 16),
        note: "",
        items: [
            {
                lineId: sellerLines[0]?.id ?? "",
                quantity: 1,
            },
        ],
    };
}
export function SellerReturnForm({ options, initialSellerId, }) {
    const createDialog = useCreateDialog();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [submitError, setSubmitError] = useState(null);
    const defaultValues = getDefaultValues(options, initialSellerId);
    const hasReturnableLines = options.lines.length > 0;
    const form = useForm({
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
    const availableSellers = useMemo(() => [
        ...new Map(options.lines
            .filter((line) => line.branchId === branchId)
            .map((line) => [
            line.sellerId,
            {
                id: line.sellerId,
                name: line.sellerName,
            },
        ])).values(),
    ].sort((left, right) => left.name.localeCompare(right.name)), [branchId, options.lines]);
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalToPartner = items.reduce((sum, item) => {
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
    const canAppendLine = availableLines.filter((line) => !items.some((currentItem) => currentItem.lineId === line.id)).length > 0;
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
            form.setValue("sellerId", availableSellers[0]?.id ?? "", {
                shouldDirty: true,
                shouldValidate: true,
            });
        }
    }, [availableSellers, form, sellerId]);
    useEffect(() => {
        const selectedLineIds = items.map((item) => item.lineId);
        items.forEach((item, index) => {
            const currentLine = availableLines.find((line) => line.id === item.lineId);
            const fallbackLine = availableLines.find((line) => !selectedLineIds.some((lineId, currentIndex) => currentIndex !== index && lineId === line.id)) ?? availableLines[0];
            const nextLine = currentLine ?? fallbackLine;
            const nextLineId = nextLine?.id ?? "";
            if (item.lineId !== nextLineId) {
                form.setValue(`items.${index}.lineId`, nextLineId, {
                    shouldDirty: true,
                    shouldValidate: true,
                });
            }
            const maxQty = Math.max(nextLine?.availableQty ?? 1, 1);
            const normalizedQty = Math.min(Math.max(Number(item.quantity || 1), 1), maxQty);
            if (Number(item.quantity || 1) !== normalizedQty) {
                form.setValue(`items.${index}.quantity`, normalizedQty, {
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
            quantity: 1,
        });
    }
    function onSubmit(values) {
        startTransition(async () => {
            setSubmitError(null);
            const result = await createSellerReturnAction(values);
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
    if (!hasReturnableLines) {
        return (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "There are no unsold partner lines left to return right now." }), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { type: "button", variant: "outline", onClick: () => createDialog?.close(), children: "Close" }) })] }));
    }
    return (_jsxs("form", { className: "grid gap-3 sm:gap-6 xl:grid-cols-[2fr_1fr]", onChangeCapture: () => {
            if (submitError) {
                setSubmitError(null);
            }
        }, onSubmit: form.handleSubmit(onSubmit), children: [_jsxs(Card, { children: [_jsx(CardHeader, { className: "p-4 sm:p-6", children: _jsx(CardTitle, { children: "Record partner return" }) }), _jsxs(CardContent, { className: "space-y-4 p-4 pt-0 sm:space-y-6 sm:p-6 sm:pt-0", children: [_jsx(FormFeedback, { errors: form.formState.errors, submitError: submitError, showValidationSummary: form.formState.submitCount > 0 }), _jsx("div", { className: "rounded-2xl border border-primary/15 bg-primary/[0.035] p-3 text-sm text-muted-foreground sm:p-4", children: "Select exact lines and quantities. Received partner items go back to the partner, while assigned-from-us items come back into branch owned stock." }), _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "seller-return-branch", children: "Branch" }), _jsx(Select, { id: "seller-return-branch", ...form.register("branchId"), children: options.branches.map((branch) => (_jsxs("option", { value: branch.id, children: [branch.code, " - ", branch.name] }, branch.id))) }), form.formState.errors.branchId?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.branchId.message })) : null] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "seller-return-seller", children: "Partner" }), _jsxs(Select, { id: "seller-return-seller", ...form.register("sellerId"), children: [_jsx("option", { value: "", children: "Select partner" }), availableSellers.map((seller) => (_jsx("option", { value: seller.id, children: seller.name }, seller.id)))] }), form.formState.errors.sellerId?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.sellerId.message })) : null] })] }), _jsx("div", { className: "grid gap-3", children: _jsxs("div", { className: "w-full max-w-[18rem] space-y-2 sm:max-w-[19rem]", children: [_jsx(Label, { htmlFor: "seller-return-date", children: "Return date" }), _jsx(Input, { id: "seller-return-date", type: "datetime-local", ...form.register("returnDate") }), form.formState.errors.returnDate?.message ? (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.returnDate.message })) : null] }) }), _jsxs("div", { className: "space-y-3 sm:space-y-4", children: [_jsx("div", { className: "flex flex-wrap items-center justify-between gap-2", children: _jsx("h3", { className: "text-sm font-semibold uppercase tracking-wide text-muted-foreground", children: "Return lines" }) }), _jsx("div", { className: "space-y-2.5 sm:space-y-4", children: fields.map((field, index) => {
                                            const selectedLine = options.lines.find((line) => line.id === items[index]?.lineId);
                                            const usedLineIds = new Set(items
                                                .map((item, currentIndex) => currentIndex === index ? null : item.lineId)
                                                .filter((lineId) => Boolean(lineId)));
                                            const selectableLines = availableLines.filter((line) => !usedLineIds.has(line.id) || line.id === items[index]?.lineId);
                                            return (_jsxs("div", { className: "rounded-2xl border border-primary/15 bg-primary/[0.035] p-3 dark:border-primary/20 dark:bg-primary/[0.08] sm:p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between gap-3", children: [_jsxs("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/85", children: ["Line ", index + 1] }), fields.length > 1 ? (_jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "h-8 shrink-0 rounded-lg border-destructive/35 bg-background/80 px-2.5 text-destructive shadow-sm hover:bg-destructive/10 hover:text-destructive", onClick: () => remove(index), children: [_jsx(Trash2, { className: "h-4 w-4" }), "Remove"] })) : null] }), _jsxs("div", { className: "grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(120px,0.9fr)]", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-xs font-medium sm:text-sm", children: "Open line" }), _jsxs(Select, { ...form.register(`items.${index}.lineId`), children: [_jsx("option", { value: "", children: "Select return line" }), selectableLines.map((line) => (_jsxs("option", { value: line.id, children: [line.productName, " | ", line.sourceLabel, " | ", line.availableQty, " open |", " ", line.direction === "TO_PARTNER"
                                                                                        ? "Back to partner"
                                                                                        : "Back to branch"] }, line.id)))] }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items?.[index]?.lineId?.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-xs font-medium sm:text-sm", children: "Qty" }), _jsx(Input, { type: "number", min: 1, max: selectedLine?.availableQty || undefined, ...form.register(`items.${index}.quantity`) }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.items?.[index]?.quantity?.message })] })] }), selectedLine ? (_jsxs("div", { className: "mt-3 rounded-2xl bg-background/80 p-3 text-[11px] text-muted-foreground sm:text-xs", children: [_jsxs("p", { children: ["Product:", " ", _jsx("span", { className: "font-medium text-foreground", children: selectedLine.productName })] }), _jsxs("p", { className: "mt-1", children: ["Source:", " ", _jsx("span", { className: "font-medium text-foreground", children: selectedLine.sourceLabel }), " ", "on ", formatDateTime(selectedLine.sourceDate)] }), _jsxs("p", { className: "mt-1", children: ["Flow:", " ", _jsx("span", { className: "font-medium text-foreground", children: selectedLine.direction === "TO_PARTNER"
                                                                            ? "Unsold received stock goes back to the partner."
                                                                            : "Unsold assigned stock goes back into branch owned stock." })] })] })) : null] }, field.id));
                                        }) }), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "button", variant: "outline", size: "sm", disabled: !canAppendLine, onClick: handleAppendItem, children: [_jsx(Plus, { className: "h-4 w-4" }), "Add line"] }) })] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { className: "p-4 sm:p-6", children: _jsx(CardTitle, { children: "Return summary" }) }), _jsxs(CardContent, { className: "space-y-3 p-4 pt-0 sm:space-y-4 sm:p-6 sm:pt-0", children: [_jsx("div", { className: "rounded-2xl bg-muted/60 p-3 sm:p-4", children: _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Lines" }), _jsx("p", { className: "mt-1 text-2xl font-semibold", children: fields.length })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Total qty" }), _jsx("p", { className: "mt-1 text-2xl font-semibold", children: totalQuantity })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "To partner" }), _jsx("p", { className: "mt-1 text-2xl font-semibold", children: totalToPartner })] })] }) }), _jsxs("div", { className: "rounded-2xl bg-muted/60 p-3 sm:p-4", children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Back to branch stock" }), _jsx("p", { className: "mt-1 text-2xl font-semibold", children: totalBackToBranch })] }), _jsx("div", { className: "rounded-2xl bg-muted/60 p-3 text-sm text-muted-foreground sm:p-4", children: "Use this screen only for unsold quantities. Sold quantities stay in the sold history and, on the received side, remain the basis for partner payable." }), _jsxs("div", { className: "flex flex-col-reverse gap-2 sm:flex-row", children: [_jsx(Button, { type: "button", variant: "outline", className: "sm:flex-1", disabled: isPending, onClick: handleCancel, children: "Cancel" }), _jsx(Button, { className: "sm:flex-1", type: "submit", disabled: isPending, children: isPending ? "Saving..." : "Post return" })] })] })] })] }));
}
