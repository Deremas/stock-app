"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type PrintReturnClientProps = {
  data: {
    id: string;
    returnNumber: string;
    returnDate: Date | string;
    seller: { fullName: string; phone: string };
    branch: { name: string };
    items: Array<{
      id: string;
      quantity: number;
      product: { name: string; sku: string | null };
    }>;
  };
};

export function PrintReturnClient({ data }: PrintReturnClientProps) {
  const returnDate = typeof data.returnDate === "string" ? new Date(data.returnDate) : data.returnDate;

  return (
    <div className="min-h-screen bg-white p-4 sm:p-8 md:p-12">
      {/* Controls - Hidden on Print */}
      <div className="mb-8 flex items-center justify-between gap-4 print:hidden">
        <Button variant="ghost" asChild className="rounded-full">
          <Link href="/sellers/returns">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to returns
          </Link>
        </Button>
        <Button onClick={() => window.print()} className="rounded-full shadow-lg">
          <Printer className="mr-2 h-4 w-4" />
          Print Voucher
        </Button>
      </div>

      {/* Voucher Container */}
      <div className="mx-auto max-w-4xl border border-border/50 p-8 shadow-sm sm:p-12 md:p-16">
        {/* Header */}
        <div className="mb-12 flex flex-col items-center justify-between gap-6 border-b pb-8 sm:flex-row">
          <div className="space-y-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold tracking-tight">RETURN VOUCHER</h1>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
              {data.returnNumber}
            </p>
          </div>
          <div className="text-center sm:text-right">
            <p className="text-lg font-bold">StockPro ERP</p>
            <p className="text-xs text-muted-foreground">{data.branch.name} Branch</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="mb-12 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Return From (Partner)
              </p>
              <p className="text-base font-semibold">{data.seller.fullName}</p>
              <p className="text-sm text-muted-foreground">{data.seller.phone}</p>
            </div>
          </div>
          <div className="space-y-4 sm:text-right">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Date & Time
              </p>
              <p className="text-base font-semibold">
                {returnDate.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {returnDate.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-12">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-foreground bg-muted/50">
                <th className="px-4 py-3 font-bold uppercase">Item Description</th>
                <th className="px-4 py-3 font-bold uppercase">SKU</th>
                <th className="px-4 py-3 text-right font-bold uppercase">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((item) => (
                <tr key={item.id} className="border-b border-border/50">
                  <td className="px-4 py-4 font-medium">{item.product.name}</td>
                  <td className="px-4 py-4 text-muted-foreground">{item.product.sku || "-"}</td>
                  <td className="px-4 py-4 text-right font-bold">{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer / Signatures */}
        <div className="mt-24 grid grid-cols-2 gap-12 pt-12 border-t border-dashed">
          <div className="space-y-8">
            <div className="h-px w-full bg-muted-foreground/30"></div>
            <p className="text-center text-[10px] font-bold uppercase tracking-widest">
              Issued By (Branch)
            </p>
          </div>
          <div className="space-y-8">
            <div className="h-px w-full bg-muted-foreground/30"></div>
            <p className="text-center text-[10px] font-bold uppercase tracking-widest">
              Partner Signature
            </p>
          </div>
        </div>

        {/* System Footer */}
        <div className="mt-20 text-center text-[10px] text-muted-foreground">
          <p>Generated by StockPro ERP on {new Date().toLocaleString()}</p>
          <p className="mt-1">Voucher ID: {data.id}</p>
        </div>
      </div>
    </div>
  );
}
