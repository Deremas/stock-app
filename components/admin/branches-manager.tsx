"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MenuItem } from "@mui/material";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from "material-react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createBranchAction,
  deleteBranchAction,
  updateBranchAction,
} from "@/lib/actions/branches";
import {
  getSimpleColumnSizing,
  materialTableBodyCellSx,
  materialTableBodyRowSx,
  materialTableBottomToolbarSx,
  materialTableContainerSx,
  materialTableHeadCellSx,
  materialTablePaginationProps,
  materialTablePropsSx,
  materialTableSearchTextFieldProps,
  materialTableToolbarSx,
} from "@/lib/material-table";
import type { BranchRow } from "@/lib/types";
import {
  branchSchema,
  type BranchFormInput,
} from "@/lib/validation/branch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableExportMenu } from "@/components/tables/table-export-menu";
import { FormFeedback } from "@/components/forms/form-feedback";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SimpleColumn } from "@/lib/table";

function getStatusVariant(value: BranchRow["status"]) {
  return value === "ACTIVE" ? "success" : "outline";
}

export function BranchesManager({ rows }: { rows: BranchRow[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [branchToEdit, setBranchToEdit] = useState<BranchRow | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<BranchRow | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<BranchFormInput>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: "",
      location: "",
    },
  });

  const columns = useMemo<MRT_ColumnDef<BranchRow>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        ...getSimpleColumnSizing({ key: "code", header: "Code" }),
      },
      {
        accessorKey: "name",
        header: "Branch",
        ...getSimpleColumnSizing({ key: "name", header: "Branch" }),
      },
      {
        accessorKey: "location",
        header: "Location",
        ...getSimpleColumnSizing({ key: "location", header: "Location" }),
      },
      {
        accessorKey: "status",
        header: "Status",
        ...getSimpleColumnSizing({ key: "status", header: "Status", type: "status" }),
        Cell: ({ cell }) => (
          <Badge variant={getStatusVariant(cell.getValue<BranchRow["status"]>())}>
            {cell.getValue<string>()}
          </Badge>
        ),
      },
    ],
    [],
  );
  const exportColumns = useMemo<SimpleColumn[]>(
    () => [
      { key: "code", header: "Code" },
      { key: "name", header: "Branch" },
      { key: "location", header: "Location" },
      { key: "status", header: "Status", type: "status" },
    ],
    [],
  );
  const isEditMode = Boolean(branchToEdit);

  const table = useMaterialReactTable({
    columns,
    data: rows,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    enableColumnFilters: false,
    enableHiding: false,
    enableRowActions: true,
    enableStickyHeader: true,
    layoutMode: "grid-no-grow",
    positionActionsColumn: "last",
    initialState: {
      density: "compact",
      pagination: {
        pageIndex: 0,
        pageSize: 20,
      },
    },
    muiTablePaperProps: {
      elevation: 0,
      sx: {
        borderRadius: "1rem",
        backgroundColor: "transparent",
        boxShadow: "none",
      },
    },
    muiTableContainerProps: {
      sx: {
        ...materialTableContainerSx,
      },
    },
    muiTableProps: {
      sx: materialTablePropsSx,
    },
    muiTopToolbarProps: {
      sx: materialTableToolbarSx,
    },
    muiBottomToolbarProps: {
      sx: materialTableBottomToolbarSx,
    },
    muiTableHeadCellProps: {
      sx: materialTableHeadCellSx,
    },
    muiTableBodyCellProps: {
      sx: materialTableBodyCellSx,
    },
    muiTableBodyRowProps: {
      sx: materialTableBodyRowSx,
    },
    muiSearchTextFieldProps: {
      ...materialTableSearchTextFieldProps,
      placeholder: "Search branches",
    },
    muiPaginationProps: materialTablePaginationProps,
    renderTopToolbarCustomActions: ({ table }) => (
      <TableExportMenu
        title="Branches"
        fileName="branches"
        columns={exportColumns}
        rows={table.getPrePaginationRowModel().rows.map((row) => row.original)}
      />
    ),
    renderRowActionMenuItems: ({ row, closeMenu }) => [
      <MenuItem
        key="edit"
        onClick={() => {
          const branch = row.original;
          setBranchToEdit(branch);
          setCreateError(null);
          form.reset({
            name: branch.name,
            location: branch.location === "-" ? "" : branch.location,
          });
          setCreateOpen(true);
          closeMenu();
        }}
      >
        <Pencil className="mr-2 h-4 w-4" />
        Edit branch
      </MenuItem>,
      <MenuItem
        key="delete"
        onClick={() => {
          setBranchToDelete(row.original);
          closeMenu();
        }}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete branch
      </MenuItem>,
    ],
  });

  function resetFormState() {
    setCreateError(null);
    setBranchToEdit(null);
    form.reset();
    setCreateOpen(false);
  }

  function handleSave(values: BranchFormInput) {
    startTransition(async () => {
      setCreateError(null);
      const result = branchToEdit
        ? await updateBranchAction({
            id: branchToEdit.id,
            ...values,
          })
        : await createBranchAction(values);

      if (!result.success) {
        setCreateError(result.message);
        toast.error(result.message);
        return;
      }

      setCreateError(null);
      toast.success(result.message);
      resetFormState();
      router.refresh();
    });
  }

  function handleDelete() {
    if (!branchToDelete) {
      return;
    }

    startTransition(async () => {
      const result = await deleteBranchAction({ branchId: branchToDelete.id });

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setBranchToDelete(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <p className="min-w-0 text-sm text-muted-foreground">
          {rows.length === 0
            ? "No branches yet. Create one to start working."
            : "Manage shop branches here."}
        </p>
        <div className="justify-self-end">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setBranchToEdit(null);
              setCreateError(null);
              form.reset({
                name: "",
                location: "",
              });
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Create branch
          </Button>
        </div>
      </div>
      <MaterialReactTable table={table} />
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setCreateError(null);
            setBranchToEdit(null);
            form.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit branch" : "Create branch"}</DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Update the branch details. Code is regenerated from the full branch name."
                : "Add a new branch with only the basic details. Code is generated from the full branch name."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-5"
            onChangeCapture={() => {
              if (createError) {
                setCreateError(null);
              }
            }}
            onSubmit={form.handleSubmit(handleSave)}
          >
            <FormFeedback
              errors={form.formState.errors}
              submitError={createError}
              showValidationSummary={form.formState.submitCount > 0}
            />
            <div className="space-y-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Main Branch" {...form.register("name")} />
                <p className="text-xs text-destructive">
                  {form.formState.errors.name?.message}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" placeholder="Head Office" {...form.register("location")} />
              <p className="text-xs text-destructive">
                {form.formState.errors.location?.message}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetFormState}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEditMode ? "Save changes" : "Save branch"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(branchToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setBranchToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete branch?</AlertDialogTitle>
            <AlertDialogDescription>
              {branchToDelete
                ? `This will permanently remove ${branchToDelete.name}. This only works if the branch has no stock or transaction history.`
                : "This will permanently remove the selected branch."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={handleDelete}>
              {isPending ? "Deleting..." : "Delete branch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
