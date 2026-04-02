"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { createContext, useContext, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
const CreateDialogContext = createContext(null);
export function useCreateDialog() {
    return useContext(CreateDialogContext);
}
export function ModalTablePage({ config, actionLabel, dialogTitle, dialogDescription, initialOpen = false, children, }) {
    const [open, setOpen] = useState(initialOpen);
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start", children: [_jsx("div", { className: "min-w-0", children: _jsx(PageHeader, { title: config.title, description: config.description }) }), _jsx("div", { className: "justify-self-end", children: _jsxs(Button, { type: "button", size: "sm", onClick: () => setOpen(true), children: [_jsx(Plus, { className: "h-4 w-4" }), actionLabel] }) })] }), config.kpis?.length ? _jsx(MetricGrid, { metrics: config.kpis }) : null, _jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsx(DataTable, { columns: config.columns, data: config.rows, exportTitle: config.title, ...(config.exportFileName
                            ? { exportFileName: config.exportFileName }
                            : {}) }) }) }), _jsx(Dialog, { open: open, onOpenChange: setOpen, children: _jsxs(DialogContent, { className: "max-h-[92vh] max-w-6xl overflow-y-auto p-0", children: [_jsx("div", { className: "border-b border-border/70 px-4 py-4 sm:px-6", children: _jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: dialogTitle }), _jsx(DialogDescription, { children: dialogDescription })] }) }), _jsx("div", { className: "p-4 sm:p-6", children: _jsx(CreateDialogContext.Provider, { value: { close: () => setOpen(false) }, children: children }) })] }) })] }));
}
