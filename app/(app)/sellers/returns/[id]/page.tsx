import { notFound } from "next/navigation";
import { ArrowLeft, Printer, Calendar, User, Building2, Package, Tag } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { getSellerReturnDetail } from "@/lib/page-data-sellers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/utils";

type ReturnDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: ReturnDetailPageProps) {
  const { id } = await params;
  const data = await getSellerReturnDetail(id);

  if (!data) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="-ml-2 rounded-full">
              <Link href="/sellers/returns">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Return Details</h1>
            <Badge variant="success" className="rounded-lg">Posted</Badge>
          </div>
          <p className="text-sm text-muted-foreground ml-9">
            Summary for return #{data.returnNumber}
          </p>
        </div>
        <div className="flex items-center gap-3 ml-9 sm:ml-0">
          <Button variant="outline" asChild className="rounded-full">
            <Link href={`/print/seller-return/${id}`}>
              <Printer className="mr-2 h-4 w-4" />
              Print Voucher
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Info Cards */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="overflow-hidden border-none shadow-sm ring-1 ring-border">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Return Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <Tag className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Return Number</p>
                  <p className="text-sm font-bold">{data.returnNumber}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Return Date</p>
                  <p className="text-sm font-bold">{formatDateTime(data.returnDate.toISOString())}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Return From (Partner)</p>
                  <p className="text-sm font-bold">{data.seller.fullName}</p>
                  <p className="text-xs text-muted-foreground">{data.seller.phone}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Branch</p>
                  <p className="text-sm font-bold">{data.branch.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items Table */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden border-none shadow-sm ring-1 ring-border">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-bold">Returned Items</CardTitle>
                  <CardDescription>Exactly {data.items.length} line items were returned</CardDescription>
                </div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {data.items.reduce((sum, item) => sum + item.quantity, 0)} Total Qty
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-muted-foreground">Product</th>
                      <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-muted-foreground">SKU</th>
                      <th className="px-6 py-4 text-right font-bold uppercase text-[10px] tracking-wider text-muted-foreground">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.items.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/5 transition-colors">
                        <td className="px-6 py-4 font-medium">{item.product.name}</td>
                        <td className="px-6 py-4 text-muted-foreground">{item.product.sku || "-"}</td>
                        <td className="px-6 py-4 text-right font-bold">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
