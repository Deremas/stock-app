"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Download, FileUp, ListPlus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { FormFeedback } from "@/components/forms/form-feedback";
import { SellerForm } from "@/components/forms/seller-form";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createBulkSellerIntakeAction, createSellerIntakeAction } from "@/lib/actions/sellers";
import type { SellerIntakeFormOptions } from "@/lib/types";
import { formatCurrency, formatDateForInput } from "@/lib/utils";
import {
  sellerIntakeSchema,
  type SellerIntakeFormInput,
} from "@/lib/validation/seller";

type CreateMode = "SINGLE" | "BULK" | "EXCEL";

type BulkIntakeItem = {
  productName: string;
  quantityBrought: number;
  sellerFixedPrice: number;
  targetSellingPrice: number;
};

type SellerIntakeFormProps = {
  options: SellerIntakeFormOptions;
  mode?: "page" | "modal";
  cancelHref?: Route;
  onCancel?: () => void;
  onSuccess?: () => void;
  initialSellerId?: string;
  initialMode?: CreateMode;
};

function getDefaultValues(
  options: SellerIntakeFormOptions,
  initialSellerId?: string,
): SellerIntakeFormInput {
  return {
    branchId: "",
    sellerId: initialSellerId ?? "",
    bringingDate: formatDateForInput(),
    note: "",
    items: [
      {
        productId: "",
        quantityBrought: 1,
        sellerFixedPrice: 0,
        targetSellingPrice: 0,
      },
    ],
  };
}

export function SellerIntakeForm({
  options,
  mode = "page",
  cancelHref,
  onCancel,
  onSuccess,
  initialSellerId,
  initialMode,
}: SellerIntakeFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sellerOptions, setSellerOptions] = useState(options.sellers);
  const [isSellerDialogOpen, setSellerDialogOpen] = useState(false);
  
  const [createMode, setCreateMode] = useState<CreateMode>(initialMode || "SINGLE");
  const [bulkContent, setBulkContent] = useState("");
  const [excelData, setExcelData] = useState<BulkIntakeItem[]>([]);

  const defaultValues = useMemo(
    () => ({
      ...getDefaultValues({ ...options, sellers: sellerOptions }, initialSellerId),
    }),
    [options, sellerOptions, initialSellerId],
  );

  const hasBranches = options.branches.length > 0;
  const hasSellers = sellerOptions.length > 0;
  const canSubmit = hasBranches && hasSellers;

  function handleDownloadTemplate() {
    const headers = [["Product Name", "Quantity", "Price Got (Payable)", "Selling Price"]];
    const sampleData = [
      ["Classic Leather Shoe", "50", "450", "850"],
      ["Canvas Sneaker Red", "30", "300", "600"],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
    XLSX.utils.book_append_sheet(wb, ws, "Seller Intake Template");
    XLSX.writeFile(wb, "seller_intake_template.xlsx");
    toast.info("Seller intake template downloaded.");
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          toast.error("The uploaded workbook does not contain any sheets.");
          return;
        }

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          toast.error("Unable to read the first sheet in this workbook.");
          return;
        }

        const rows = XLSX.utils.sheet_to_json<any>(sheet);

        const parsed = rows.map((row) => ({
          productName: row["Product Name"] || row["Name"] || "",
          quantityBrought: Number(row["Quantity"] || row["Qty"] || 0),
          sellerFixedPrice: Number(row["Price Got (Payable)"] || row["Price"] || 0),
          targetSellingPrice: Number(row["Selling Price"] || 0),
        })).filter(r => r.productName);

        setExcelData(parsed);
        toast.success(`Parsed ${parsed.length} items from Excel.`);
      } catch (err) {
        toast.error("Failed to parse Excel file. Ensure it matches the template.");
      }
    };
    reader.readAsBinaryString(file);
  }

  const form = useForm<SellerIntakeFormInput>({
    resolver: zodResolver(sellerIntakeSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const sellerId = form.watch("sellerId");
  const items = form.watch("items");
  const totalReceivedQuantity = items.reduce(
    (sum, item) => sum + Number(item.quantityBrought || 0),
    0,
  );
  const payable = items.reduce((sum, item) => {
    return sum + Number(item.quantityBrought || 0) * Number(item.sellerFixedPrice || 0);
  }, 0);

  useEffect(() => {
    if (sellerOptions.length === 0) {
      if (sellerId) {
        form.setValue("sellerId", "", {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      return;
    }

    if (sellerId && !sellerOptions.some((seller) => seller.id === sellerId)) {
      form.setValue("sellerId", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, sellerId, sellerOptions]);

  function getResetValues() {
    return {
      ...getDefaultValues({ ...options, sellers: sellerOptions }, initialSellerId),
      branchId: form.getValues("branchId") || defaultValues.branchId,
      sellerId:
        form.getValues("sellerId") ||
        sellerOptions.find((seller) => seller.id === initialSellerId)?.id ||
        "",
    } satisfies SellerIntakeFormInput;
  }

  function handleCancel() {
    setSubmitError(null);
    form.reset(getResetValues());

    if (mode === "page") {
      onCancel?.();

      if (cancelHref) {
        router.push(cancelHref);
      } else {
        router.back();
      }

      return;
    }

    onCancel?.();
    createDialog?.close();
  }

  function onSubmit(values: SellerIntakeFormInput) {
    startTransition(async () => {
      setSubmitError(null);
      const result = await createSellerIntakeAction(values);

      if (!result.success) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }

      setSubmitError(null);
      toast.success(result.message);
      form.reset(getResetValues());
      router.refresh();
      onSuccess?.();
      createDialog?.close();
    });
  }

  function handleBulkSubmit() {
    startTransition(async () => {
      setSubmitError(null);
      const values = form.getValues();
      if (!values.branchId || !values.sellerId) {
        setSubmitError("Please select branch and seller first.");
        return;
      }

      let itemsToSubmit: BulkIntakeItem[] = [];

      if (createMode === "BULK") {
        const lines = bulkContent.split("\n").filter((line) => line.trim());
        itemsToSubmit = lines.map((line) => {
          const [productName, quantity, priceGot, sellingPrice] = line.split(",").map((s) => s.trim());
          return {
            productName: productName || "",
            quantityBrought: Number(quantity || 0),
            sellerFixedPrice: Number(priceGot || 0),
            targetSellingPrice: Number(sellingPrice || 0),
          };
        }).filter(item => item.productName);
      } else {
        itemsToSubmit = excelData;
      }

      if (itemsToSubmit.length === 0) {
        setSubmitError("No valid items to submit.");
        return;
      }

      const result = await createBulkSellerIntakeAction({
        branchId: values.branchId,
        sellerId: values.sellerId,
        bringingDate: values.bringingDate,
        ...(values.note ? { note: values.note } : {}),
        items: itemsToSubmit,
      });

      if (!result.success) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }

      setSubmitError(null);
      toast.success(result.message);
      setBulkContent("");
      setExcelData([]);
      form.reset(getResetValues());
      router.refresh();
      onSuccess?.();
      createDialog?.close();
    });
  }

  function handleAppendItem() {
    append({
      productId: "",
      quantityBrought: 1,
      sellerFixedPrice: 0,
      targetSellingPrice: 0,
    });
  }

  return (
    <>
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
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>Received from seller</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Record consignment stock arrivals.
                </p>
              </div>
              
              <div className="flex rounded-lg border bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setCreateMode("SINGLE")}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    createMode === "SINGLE"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode("BULK")}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    createMode === "BULK"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ListPlus className="h-3.5 w-3.5" />
                  Bulk
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode("EXCEL")}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    createMode === "EXCEL"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileUp className="h-3.5 w-3.5" />
                  Excel
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:space-y-6 sm:p-6 sm:pt-0">
            <FormFeedback
              errors={form.formState.errors}
              submitError={submitError}
              showValidationSummary={form.formState.submitCount > 0}
            />
            {!hasBranches ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4">
                Create active branches and sellers before recording received items.
              </div>
            ) : !hasSellers ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4">
                Create an active seller before recording received items.
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="branchId">Branch</Label>
                <Select id="branchId" {...form.register("branchId")}>
                  <option value="">Select an option</option>
                  {options.branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
                {form.formState.errors.branchId?.message ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.branchId.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="sellerId">Seller</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-primary"
                    onClick={() => setSellerDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add seller
                  </Button>
                </div>
                <Select id="sellerId" {...form.register("sellerId")}>
                  <option value="">Select seller</option>
                  {sellerOptions.map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.name}
                    </option>
                  ))}
                </Select>
                {form.formState.errors.sellerId?.message ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.sellerId.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="bringingDate">Bringing date</Label>
                <Input
                  id="bringingDate"
                  type="datetime-local"
                  {...form.register("bringingDate")}
                />
                {form.formState.errors.bringingDate?.message ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.bringingDate.message}
                  </p>
                ) : null}
              </div>
            </div>
            {createMode === "SINGLE" ? (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Received items
                  </h3>
                </div>
                <div className="space-y-2.5 sm:space-y-4">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-3 dark:border-primary/20 dark:bg-primary/[0.08] sm:p-4"
                    >
                      <div className="mb-3 flex items-center justify-between sm:mb-4">
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
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-[minmax(0,2fr)_minmax(80px,0.7fr)_minmax(100px,1fr)_minmax(100px,1fr)]">
                        <div className="col-span-2 space-y-2 md:col-span-1">
                          <Label className="text-xs font-medium sm:text-sm">Product</Label>
                          <Select
                            {...form.register(`items.${index}.productId`)}
                          >
                            <option value="">Select product</option>
                            {options.products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="col-span-1 space-y-2 md:col-span-1">
                          <Label className="text-xs font-medium sm:text-sm">Qty</Label>
                          <Input
                            type="number"
                            min={1}
                            {...form.register(`items.${index}.quantityBrought`)}
                          />
                        </div>
                        <div className="col-span-1 space-y-2 md:col-span-1">
                          <Label className="text-xs font-medium sm:text-sm">Price got</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            {...form.register(`items.${index}.sellerFixedPrice`)}
                          />
                        </div>
                        <div className="col-span-2 space-y-2 md:col-span-1">
                          <Label className="text-xs font-medium sm:text-sm">Selling price</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            {...form.register(`items.${index}.targetSellingPrice`)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={handleAppendItem}>
                    <Plus className="h-4 w-4" />
                    Add item
                  </Button>
                </div>
              </div>
            ) : createMode === "BULK" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Bulk Paste (CSV Format)</Label>
                  <Textarea
                    placeholder="Product Name, Quantity, Price Got, Selling Price (one per line)"
                    className="min-h-[200px] font-mono text-xs"
                    value={bulkContent}
                    onChange={(e) => setBulkContent(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Example: Classic Shoe, 10, 450, 850
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 p-8 text-center transition-colors hover:bg-muted/50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <FileUp className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Upload Excel file</p>
                    <p className="text-xs text-muted-foreground">
                      Import your intake data using our standardized template.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate}>
                      <Download className="mr-2 h-4 w-4" />
                      Download Template
                    </Button>
                    <div className="relative">
                      <Input
                        type="file"
                        accept=".xlsx, .xls"
                        className="absolute inset-0 cursor-pointer opacity-0"
                        onChange={handleFileUpload}
                      />
                      <Button type="button" size="sm">
                        <FileUp className="mr-2 h-4 w-4" />
                        Select File
                      </Button>
                    </div>
                  </div>
                </div>

                {excelData.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground">Preview (First 5 items)</h4>
                      <p className="text-xs font-medium text-primary">{excelData.length} items found</p>
                    </div>
                    <div className="overflow-hidden rounded-xl border bg-background">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="px-3 py-2 font-semibold">Item</th>
                            <th className="px-3 py-2 font-semibold">Qty</th>
                            <th className="px-3 py-2 font-semibold">Price Got</th>
                            <th className="px-3 py-2 font-semibold">Sell Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {excelData.slice(0, 5).map((row, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 font-medium">{row.productName}</td>
                              <td className="px-3 py-2">{row.quantityBrought}</td>
                              <td className="px-3 py-2">{formatCurrency(row.sellerFixedPrice)}</td>
                              <td className="px-3 py-2">{formatCurrency(row.targetSellingPrice)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Seller payable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:space-y-4 sm:p-6 sm:pt-0">
            <div className="rounded-2xl bg-muted/60 p-3 sm:p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Items</p>
                  <p className="mt-1 text-2xl font-semibold">{fields.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total qty</p>
                  <p className="mt-1 text-2xl font-semibold">{totalReceivedQuantity}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-muted/60 p-3 sm:p-4">
              <p className="text-sm text-muted-foreground">
                Total payable if all received items sell
              </p>
              <p className="mt-2 text-3xl font-semibold">{formatCurrency(payable)}</p>
            </div>
            {/* Summary description removed for simplicity */}
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
              {createMode === "SINGLE" ? (
                <Button className="sm:flex-1" type="submit" disabled={isPending || !canSubmit}>
                  {isPending ? "Saving..." : "Save intake"}
                </Button>
              ) : (
                <Button 
                  type="button" 
                  className="sm:flex-1" 
                  disabled={isPending || !canSubmit}
                  onClick={handleBulkSubmit}
                >
                  {isPending ? "Saving..." : `Save ${createMode.toLowerCase()} intake`}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </form>
      <Dialog open={isSellerDialogOpen} onOpenChange={setSellerDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add seller</DialogTitle>
            <DialogDescription>
              Create a seller record without leaving the received-stock screen.
            </DialogDescription>
          </DialogHeader>
          <SellerForm
            submitLabel="Save seller"
            refreshAfterSuccess={false}
            onCancel={() => setSellerDialogOpen(false)}
            onSuccess={(partner) => {
              setSellerOptions((current) =>
                [...current, partner].sort((left, right) =>
                  left.name.localeCompare(right.name),
                ),
              );
              form.setValue("sellerId", partner.id, {
                shouldDirty: true,
                shouldValidate: true,
              });
              setSellerDialogOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
