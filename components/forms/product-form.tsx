"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import * as XLSX from "xlsx";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useCreateDialog } from "@/components/tables/modal-table-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createBulkProductsAction,
  createProductAction,
  updateProductAction,
  type BulkProductInput,
} from "@/lib/actions/products";
import {
  productEditorSchema,
  type ProductEditorFormInput,
  type ProductEditorInput,
} from "@/lib/validation/product";
import { PRODUCT_UNITS } from "@/lib/product-units";
import { Download, FileUp, ListPlus, UserPlus } from "lucide-react";

type CreateMode = "SINGLE" | "BULK" | "EXCEL";

type ProductFormProps = {
  intent?: "create" | "edit";
  initialValues?: ProductEditorFormInput;
  mode?: "page" | "modal";
  cancelHref?: Route;
  onCancel?: () => void;
  onSuccess?: () => void;
  initialMode?: CreateMode;
};

const createDefaultValues: ProductEditorFormInput = {
  id: "",
  name: "",
  minimumStockAlert: 0,
  unit: "pcs",
  description: "",
};

export function ProductForm({
  intent = "create",
  initialValues,
  mode = "page",
  cancelHref,
  onCancel,
  onSuccess,
  initialMode,
}: ProductFormProps) {
  const createDialog = useCreateDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = useMemo(
    () => ({
      ...createDefaultValues,
      ...(initialValues ?? {}),
    }),
    [initialValues],
  );
  const form = useForm<ProductEditorFormInput, undefined, ProductEditorInput>({
    resolver: zodResolver(productEditorSchema),
    defaultValues,
  });
  const [createMode, setCreateMode] = useState<CreateMode>(initialMode || "SINGLE");
  const [bulkContent, setBulkContent] = useState("");
  const [excelData, setExcelData] = useState<BulkProductInput[]>([]);
  const isEdit = intent === "edit";

  function handleDownloadTemplate() {
    const headers = [["Item Name", "Unit", "Low Stock Alert", "Description"]];
    const sampleData = [
      ["Apple iPhone 15 Pro", "pcs", "5", "Latest flagship model"],
      ["USB-C Cable 2m", "pcs", "20", "Fast charging support"],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
    XLSX.utils.book_append_sheet(wb, ws, "Items Template");
    XLSX.writeFile(wb, "stockpro_items_template.xlsx");
    toast.info("Sample template downloaded.");
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

        const parsed: BulkProductInput[] = rows.map((row) => ({
          name: String(row["Item Name"] || row["name"] || "").trim(),
          unit: String(row["Unit"] || row["unit"] || "pcs").trim(),
          minimumStockAlert: Number(row["Low Stock Alert"] || row["alert"] || 0),
          description: String(row["Description"] || row["description"] || "").trim(),
        })).filter(item => item.name.length >= 2);

        setExcelData(parsed);
        toast.success(`Parsed ${parsed.length} items from file.`);
      } catch (err) {
        toast.error("Error parsing file. Please use the provided template.");
      }
    };
    reader.readAsBinaryString(file);
  }

  function handleCancel() {
    setSubmitError(null);
    form.reset(defaultValues);
    setBulkContent("");
    setExcelData([]);

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

  function onSubmit(values: ProductEditorInput) {
    startTransition(async () => {
      setSubmitError(null);

      if (!isEdit) {
        let itemsToCreate: BulkProductInput[] = [];

        if (createMode === "BULK") {
          itemsToCreate = bulkContent
            .split("\n")
            .map((n) => n.trim())
            .filter((n) => n.length >= 2)
            .map((name) => ({ name }));
        } else if (createMode === "EXCEL") {
          itemsToCreate = excelData;
        }

        if (createMode !== "SINGLE") {
          if (itemsToCreate.length === 0) {
            setSubmitError("Please provide at least one valid item to create.");
            return;
          }

          const result = await createBulkProductsAction(itemsToCreate);
          if (!result.success) {
            setSubmitError(result.message);
            toast.error(result.message);
            return;
          }

          toast.success(result.message);
          router.refresh();
          onSuccess?.();
          createDialog?.close();
          return;
        }
      }

      const result = isEdit
        ? await updateProductAction({
            id: values.id ?? "",
            name: values.name,
            minimumStockAlert: values.minimumStockAlert,
            unit: values.unit,
            description: values.description,
          })
        : await createProductAction({
            name: values.name,
            minimumStockAlert: values.minimumStockAlert,
            unit: values.unit,
            description: values.description,
          });

      if (!result.success) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }

      setSubmitError(null);
      toast.success(result.message);
      form.reset(defaultValues);
      router.refresh();
      onSuccess?.();
      createDialog?.close();
    });
  }

  return (
    <form
      className="space-y-6"
      onChangeCapture={() => {
        if (submitError) {
          setSubmitError(null);
        }
      }}
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="flex items-center justify-between">
        <FormFeedback
          errors={form.formState.errors}
          submitError={submitError}
          showValidationSummary={form.formState.submitCount > 0}
        />
        {!isEdit && (
          <div className="flex rounded-lg border bg-muted/50 p-1">
            {[
              { id: "SINGLE", label: "Single", icon: UserPlus },
              { id: "BULK", label: "Bulk", icon: ListPlus },
              { id: "EXCEL", label: "Excel", icon: FileUp },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    createMode === m.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setCreateMode(m.id as CreateMode)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {createMode === "BULK" && !isEdit ? (
        <div className="space-y-2">
          <Label htmlFor="bulk-items">Bulk Item List</Label>
          <Textarea
            id="bulk-items"
            rows={10}
            placeholder="Enter one item name per line...&#10;Apple iPhone 15&#10;Samsung Galaxy S24"
            value={bulkContent}
            onChange={(e) => setBulkContent(e.target.value)}
            className="font-mono text-sm leading-relaxed"
          />
          <p className="text-xs text-muted-foreground">
            Items will be created with default settings. Use the Excel mode for more details.
          </p>
        </div>
      ) : createMode === "EXCEL" && !isEdit ? (
        <div className="space-y-6 py-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-bold tracking-tight">Excel Import</h4>
              <p className="text-xs text-muted-foreground">Upload your spreadsheet to create multiple items at once.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={handleDownloadTemplate}
            >
              <Download className="mr-2 h-4 w-4" />
              Template
            </Button>
          </div>

          <div className="group relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 transition-colors hover:border-primary/50 hover:bg-primary/5">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="absolute inset-0 z-10 cursor-pointer opacity-0"
              onChange={handleFileUpload}
            />
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-full bg-primary/10 p-3 text-primary transition-transform group-hover:scale-110">
                <FileUp className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {excelData.length > 0 ? `${excelData.length} Items Loaded` : "Click or drag to upload Excel/CSV"}
              </p>
            </div>
          </div>

          {excelData.length > 0 && (
            <div className="rounded-xl border bg-muted/20 p-4">
              <h5 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Preview (First 5 items)</h5>
              <div className="space-y-2">
                {excelData.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground">{item.unit} | Alert: {item.minimumStockAlert}</span>
                  </div>
                ))}
                {excelData.length > 5 && (
                  <p className="text-[10px] text-muted-foreground italic">...and {excelData.length - 5} more items</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="item-name">Item name</Label>
            <Input id="item-name" placeholder="e.g. USB-C Power Adapter" {...form.register("name")} />
            <p className="text-xs text-destructive">{form.formState.errors.name?.message}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-alert">Low stock alert</Label>
            <Input
              id="item-alert"
              type="number"
              min={0}
              {...form.register("minimumStockAlert")}
            />
            <p className="text-xs text-destructive">
              {form.formState.errors.minimumStockAlert?.message}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-unit">Unit of Measure</Label>
            <Select id="item-unit" {...form.register("unit")}>
              {PRODUCT_UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-destructive">{form.formState.errors.unit?.message}</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="item-description">Description</Label>
            <Textarea
              id="item-description"
              rows={3}
              placeholder="Optional notes or technical specifications..."
              {...form.register("description")}
            />
            <p className="text-xs text-destructive">
              {form.formState.errors.description?.message}
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : isEdit ? "Save changes" : "Save item"}
        </Button>
      </div>
    </form>
  );
}
