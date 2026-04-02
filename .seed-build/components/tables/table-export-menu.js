"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { exportRowsToExcel, exportRowsToPdf } from "@/lib/table-export";
export function TableExportMenu({ title, fileName, columns, rows, }) {
    function handleExcelExport() {
        exportRowsToExcel({
            columns,
            rows,
            fileName,
            sheetName: title,
        });
    }
    function handlePdfExport() {
        const opened = exportRowsToPdf({
            title,
            columns,
            rows,
            fileName,
        });
        if (!opened) {
            toast.error("Allow pop-ups to export this table as PDF.");
        }
    }
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { size: "sm", variant: "outline", children: [_jsx(Download, { className: "h-4 w-4" }), "Export", _jsx(ChevronDown, { className: "h-4 w-4" })] }) }), _jsxs(DropdownMenuContent, { align: "start", className: "w-48", children: [_jsxs(DropdownMenuItem, { onSelect: handleExcelExport, children: [_jsx(FileSpreadsheet, { className: "mr-2 h-4 w-4" }), "Excel (.xlsx)"] }), _jsxs(DropdownMenuItem, { onSelect: handlePdfExport, children: [_jsx(FileText, { className: "mr-2 h-4 w-4" }), "PDF"] })] })] }));
}
