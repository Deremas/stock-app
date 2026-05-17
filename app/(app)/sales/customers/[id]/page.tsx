import { notFound } from "next/navigation";
import { 
  ArrowLeft, 
  ShoppingBag, 
  CreditCard, 
  History, 
  User, 
  MapPin, 
  Phone, 
  FileText,
  TrendingUp,
  Receipt
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { getCustomerMetrics } from "@/lib/page-data-sales";
import { getTablePageConfig } from "@/lib/page-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";
import { CustomerWorkspaceTabs } from "@/components/sales/customer-workspace-tabs";

type CustomerDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<RouteSearchParams>;
};

type MetricCard = {
  title: string;
  value: string;
  meta: string;
  tone: "default" | "success" | "warning" | "danger";
};

export default async function Page({ params, searchParams }: CustomerDetailPageProps) {
  const { id: customerId } = await params;
  const p = await searchParams;
  const branchId = getSingleSearchParam(p, "branchId");
  const tableFilters = {
    customerId,
    ...(branchId ? { branchId } : {}),
  };

  const [customer, metricsData, salesConfig, creditConfig, paymentsConfig, itemsConfig] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        note: true,
        isActive: true,
      },
    }),
    getCustomerMetrics(customerId, branchId),
    getTablePageConfig("salesList", tableFilters),
    getTablePageConfig("salesCustomerCredit", tableFilters),
    getTablePageConfig("salesCustomerPayments", tableFilters),
    getTablePageConfig("salesSoldItems", tableFilters),
  ]);

  if (!customer) {
    return notFound();
  }

  const { totalPurchases, totalPaid, creditBalance, lastPurchaseAt } = metricsData;

  const metrics: MetricCard[] = [
    {
      title: "Lifetime Purchases",
      value: formatCurrency(totalPurchases),
      meta: "Gross volume settled",
      tone: "default",
    },
    {
      title: "Amount Paid",
      value: formatCurrency(totalPaid),
      meta: "Realized revenue",
      tone: "success",
    },
    {
      title: "Credit Balance",
      value: formatCurrency(creditBalance),
      meta: "Outstanding debt",
      tone: creditBalance > 0 ? "danger" : "default",
    },
    {
      title: "Last Activity",
      value: lastPurchaseAt ? formatDateTime(lastPurchaseAt.toISOString()) : "-",
      meta: "Most recent sale",
      tone: "default",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="-ml-2 rounded-full">
              <Link href="/sales/customers">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
            <Badge variant={customer.isActive ? "success" : "secondary"} className="rounded-lg">
              {customer.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground ml-9">Customer Relationship Dashboard</p>
        </div>
        <div className="flex items-center gap-3 ml-9 sm:ml-0">
          <Button size="sm" className="rounded-full px-5 shadow-lg" asChild>
            <Link href={`/sales/new?customerId=${customerId}`}>
              <ShoppingBag className="mr-2 h-4 w-4" />
              New Sale
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title} className="border-none shadow-sm ring-1 ring-border">
            <CardContent className="p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">{metric.title}</p>
              <div className="mt-2 flex items-baseline justify-between">
                <h3 className={`text-xl font-bold tracking-tight ${
                  metric.tone === "success" ? "text-success" : 
                  metric.tone === "danger" ? "text-danger" : 
                  metric.tone === "warning" ? "text-warning" : "text-foreground"
                }`}>
                  {metric.value}
                </h3>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground font-medium">{metric.meta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-sm ring-1 ring-border overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Customer Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <Phone className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Phone Number</p>
                  <p className="text-sm font-bold">{customer.phone || "-"}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Address</p>
                  <p className="text-sm font-bold">{customer.address || "-"}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Internal Note</p>
                  <p className="text-xs text-muted-foreground italic">"{customer.note || "No notes added for this customer."}"</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
           <CustomerWorkspaceTabs
             customerId={customerId}
             salesConfig={salesConfig}
             creditConfig={creditConfig}
             paymentsConfig={paymentsConfig}
             itemsConfig={itemsConfig}
             hrefs={{
               newSale: `/sales/new?customerId=${customerId}`,
               newPayment: `/sales/customer-payments?customerId=${customerId}&open=1`,
             }}
           />
        </div>
      </div>
    </div>
  );
}
