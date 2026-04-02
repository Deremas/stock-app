"use client";
import { utils, writeFileXLSX } from "xlsx";
import { formatCurrency, formatDateTime, toTitleCase } from "@/lib/utils";
function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
export function slugifyExportName(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "table-export";
}
export function formatTableExportValue(column, row) {
    const rawValue = row[column.key];
    if (rawValue === null || rawValue === undefined || rawValue === "") {
        return "-";
    }
    if (column.type === "currency") {
        return formatCurrency(typeof rawValue === "number" || typeof rawValue === "string"
            ? rawValue
            : 0);
    }
    if (column.type === "dateTime") {
        return formatDateTime(String(rawValue));
    }
    if (column.type === "status") {
        return toTitleCase(String(rawValue));
    }
    if (column.type === "multiline") {
        return String(rawValue).replaceAll("\n", " | ");
    }
    return String(rawValue);
}
function buildExportRows(columns, rows) {
    return rows.map((row) => Object.fromEntries(columns.map((column) => [column.header, formatTableExportValue(column, row)])));
}
export function exportRowsToExcel(args) {
    const exportRows = buildExportRows(args.columns, args.rows);
    const worksheet = utils.json_to_sheet(exportRows);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, args.sheetName?.trim() || "Data");
    writeFileXLSX(workbook, `${slugifyExportName(args.fileName)}.xlsx`);
}
export function exportRowsToPdf(args) {
    if (typeof window === "undefined") {
        return false;
    }
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
        return false;
    }
    const heading = escapeHtml(args.title);
    const exportedAt = escapeHtml(formatDateTime(new Date().toISOString()));
    const headerRow = args.columns
        .map((column) => `<th style="border:1px solid #cbd5e1;padding:10px 12px;text-align:left;background:#eff6ff;font-size:12px;">${escapeHtml(column.header)}</th>`)
        .join("");
    const bodyRows = args.rows.length > 0
        ? args.rows
            .map((row) => {
            const cells = args.columns
                .map((column) => `<td style="border:1px solid #cbd5e1;padding:10px 12px;vertical-align:top;font-size:12px;">${escapeHtml(formatTableExportValue(column, row))}</td>`)
                .join("");
            return `<tr>${cells}</tr>`;
        })
            .join("")
        : `<tr><td colspan="${Math.max(args.columns.length, 1)}" style="border:1px solid #cbd5e1;padding:14px 12px;text-align:center;color:#64748b;font-size:12px;">No rows available.</td></tr>`;
    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(slugifyExportName(args.fileName))}</title>
    <style>
      body {
        margin: 24px;
        font-family: "Segoe UI", Arial, sans-serif;
        color: #0f172a;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 20px;
      }
      p {
        margin: 0 0 20px;
        color: #475569;
        font-size: 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      @media print {
        body {
          margin: 12px;
        }
      }
    </style>
  </head>
  <body>
    <h1>${heading}</h1>
    <p>Exported at ${exportedAt}</p>
    <table>
      <thead>
        <tr>${headerRow}</tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </body>
</html>`);
    printWindow.document.close();
    const triggerPrint = () => {
        printWindow.focus();
        printWindow.print();
    };
    printWindow.onload = triggerPrint;
    window.setTimeout(triggerPrint, 250);
    return true;
}
