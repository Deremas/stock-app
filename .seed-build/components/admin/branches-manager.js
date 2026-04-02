"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MenuItem } from "@mui/material";
import { MaterialReactTable, useMaterialReactTable, } from "material-react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createBranchAction, deleteBranchAction, updateBranchAction, } from "@/lib/actions/branches";
import { getSimpleColumnSizing, materialTableBodyCellSx, materialTableBodyRowSx, materialTableBottomToolbarSx, materialTableContainerSx, materialTableHeadCellSx, materialTablePaginationProps, materialTablePropsSx, materialTableSearchTextFieldProps, materialTableToolbarSx, } from "@/lib/material-table";
import { branchSchema, } from "@/lib/validation/branch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableExportMenu } from "@/components/tables/table-export-menu";
import { FormFeedback } from "@/components/forms/form-feedback";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
function getStatusVariant(value) {
    return value === "ACTIVE" ? "success" : "outline";
}
export function BranchesManager({ rows }) {
    const router = useRouter();
    const [createOpen, setCreateOpen] = useState(false);
    const [branchToEdit, setBranchToEdit] = useState(null);
    const [branchToDelete, setBranchToDelete] = useState(null);
    const [createError, setCreateError] = useState(null);
    const [isPending, startTransition] = useTransition();
    const form = useForm({
        resolver: zodResolver(branchSchema),
        defaultValues: {
            name: "",
            location: "",
        },
    });
    const columns = useMemo(() => [
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
            Cell: ({ cell }) => (_jsx(Badge, { variant: getStatusVariant(cell.getValue()), children: cell.getValue() })),
        },
    ], []);
    const exportColumns = useMemo(() => [
        { key: "code", header: "Code" },
        { key: "name", header: "Branch" },
        { key: "location", header: "Location" },
        { key: "status", header: "Status", type: "status" },
    ], []);
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
        renderTopToolbarCustomActions: ({ table }) => (_jsx(TableExportMenu, { title: "Branches", fileName: "branches", columns: exportColumns, rows: table.getPrePaginationRowModel().rows.map((row) => row.original) })),
        renderRowActionMenuItems: ({ row, closeMenu }) => [
            _jsxs(MenuItem, { onClick: () => {
                    const branch = row.original;
                    setBranchToEdit(branch);
                    setCreateError(null);
                    form.reset({
                        name: branch.name,
                        location: branch.location === "-" ? "" : branch.location,
                    });
                    setCreateOpen(true);
                    closeMenu();
                }, children: [_jsx(Pencil, { className: "mr-2 h-4 w-4" }), "Edit branch"] }, "edit"),
            _jsxs(MenuItem, { onClick: () => {
                    setBranchToDelete(row.original);
                    closeMenu();
                }, children: [_jsx(Trash2, { className: "mr-2 h-4 w-4" }), "Delete branch"] }, "delete"),
        ],
    });
    function resetFormState() {
        setCreateError(null);
        setBranchToEdit(null);
        form.reset();
        setCreateOpen(false);
    }
    function handleSave(values) {
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
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center", children: [_jsx("p", { className: "min-w-0 text-sm text-muted-foreground", children: rows.length === 0
                            ? "No branches yet. Create one to start working."
                            : "Manage shop branches here." }), _jsx("div", { className: "justify-self-end", children: _jsxs(Button, { type: "button", size: "sm", onClick: () => {
                                setBranchToEdit(null);
                                setCreateError(null);
                                form.reset({
                                    name: "",
                                    location: "",
                                });
                                setCreateOpen(true);
                            }, children: [_jsx(Plus, { className: "h-4 w-4" }), "Create branch"] }) })] }), _jsx(MaterialReactTable, { table: table }), _jsx(Dialog, { open: createOpen, onOpenChange: (open) => {
                    setCreateOpen(open);
                    if (!open) {
                        setCreateError(null);
                        setBranchToEdit(null);
                        form.reset();
                    }
                }, children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: isEditMode ? "Edit branch" : "Create branch" }), _jsx(DialogDescription, { children: isEditMode
                                        ? "Update the branch details. Code is regenerated from the full branch name."
                                        : "Add a new branch with only the basic details. Code is generated from the full branch name." })] }), _jsxs("form", { className: "space-y-5", onChangeCapture: () => {
                                if (createError) {
                                    setCreateError(null);
                                }
                            }, onSubmit: form.handleSubmit(handleSave), children: [_jsx(FormFeedback, { errors: form.formState.errors, submitError: createError, showValidationSummary: form.formState.submitCount > 0 }), _jsx("div", { className: "space-y-2", children: _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "name", children: "Name" }), _jsx(Input, { id: "name", placeholder: "Main Branch", ...form.register("name") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.name?.message })] }) }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "location", children: "Location" }), _jsx(Input, { id: "location", placeholder: "Head Office", ...form.register("location") }), _jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.location?.message })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: resetFormState, children: "Cancel" }), _jsx(Button, { type: "submit", disabled: isPending, children: isPending ? "Saving..." : isEditMode ? "Save changes" : "Save branch" })] })] })] }) }), _jsx(AlertDialog, { open: Boolean(branchToDelete), onOpenChange: (open) => {
                    if (!open) {
                        setBranchToDelete(null);
                    }
                }, children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "Delete branch?" }), _jsx(AlertDialogDescription, { children: branchToDelete
                                        ? `This will permanently remove ${branchToDelete.name}. This only works if the branch has no stock or transaction history.`
                                        : "This will permanently remove the selected branch." })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { disabled: isPending, children: "Cancel" }), _jsx(AlertDialogAction, { disabled: isPending, onClick: handleDelete, children: isPending ? "Deleting..." : "Delete branch" })] })] }) })] }));
}
