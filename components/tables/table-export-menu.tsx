"use client";

import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SimpleColumn, SimpleRow } from "@/lib/table";
import { exportRowsToExcel, exportRowsToPdf } from "@/lib/table-export";

type TableExportMenuProps = {
  title: string;
  fileName: string;
  columns: SimpleColumn[];
  rows: SimpleRow[];
};

export function TableExportMenu({
  title,
  fileName,
  columns,
  rows,
}: TableExportMenuProps) {
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Download className="h-4 w-4" />
          Export
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onSelect={handleExcelExport}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handlePdfExport}>
          <FileText className="mr-2 h-4 w-4" />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
