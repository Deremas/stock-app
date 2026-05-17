"use client";

import * as React from "react";
import { 
  ShoppingBag, 
  CreditCard, 
  History, 
  Receipt,
  TrendingUp,
  PackageCheck
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DailyCheckTableCard } from "@/components/sales/daily-check-table-card";
import type { SimpleRow, SimpleColumn } from "@/lib/table";

type TableConfig = {
  title: string;
  columns: SimpleColumn[];
  rows: SimpleRow[];
};

type CustomerWorkspaceTabsProps = {
  customerId: string;
  salesConfig: TableConfig;
  creditConfig: TableConfig;
  paymentsConfig: TableConfig;
  itemsConfig: TableConfig;
  hrefs: {
    newSale: string;
    newPayment: string;
  };
};

export function CustomerWorkspaceTabs({
  customerId,
  salesConfig,
  creditConfig,
  paymentsConfig,
  itemsConfig,
  hrefs
}: CustomerWorkspaceTabsProps) {
  const [activeTab, setActiveTab] = React.useState("sales");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <TabsList className="w-full sm:w-auto overflow-x-auto no-scrollbar">
          <TabsTrigger 
            active={activeTab === "sales"} 
            onClick={() => setActiveTab("sales")}
          >
            <ShoppingBag className="h-4 w-4" />
            Sales History
          </TabsTrigger>
          <TabsTrigger 
            active={activeTab === "credit"} 
            onClick={() => setActiveTab("credit")}
          >
            <CreditCard className="h-4 w-4" />
            Open Credit
          </TabsTrigger>
          <TabsTrigger 
            active={activeTab === "payments"} 
            onClick={() => setActiveTab("payments")}
          >
            <Receipt className="h-4 w-4" />
            Payment Logs
          </TabsTrigger>
          <TabsTrigger 
            active={activeTab === "items"} 
            onClick={() => setActiveTab("items")}
          >
            <PackageCheck className="h-4 w-4" />
            Purchased Items
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent active={activeTab === "sales"}>
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button asChild size="sm" className="rounded-xl px-5 shadow-sm">
              <a href={hrefs.newSale} className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                New Sale
              </a>
            </Button>
          </div>
          <DailyCheckTableCard
            {...salesConfig}
            description="Complete sales ledger for this customer, including fully settled and outstanding transactions."
            exportFileName={`customer-${customerId}-sales`}
            emptyStateMessage="No sales records found for this customer."
          />
        </div>
      </TabsContent>

      <TabsContent active={activeTab === "credit"}>
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button asChild size="sm" variant="destructive" className="rounded-xl px-5 shadow-sm">
              <a href={hrefs.newPayment} className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Record Payment
              </a>
            </Button>
          </div>
          <DailyCheckTableCard
            {...creditConfig}
            description="Active outstanding credit balances that require settlement."
            exportFileName={`customer-${customerId}-credit`}
            emptyStateMessage="No outstanding credit found for this customer."
          />
        </div>
      </TabsContent>

      <TabsContent active={activeTab === "payments"}>
        <div className="space-y-4">
          <DailyCheckTableCard
            {...paymentsConfig}
            description="History of all payments received from this customer."
            exportFileName={`customer-${customerId}-payments`}
            emptyStateMessage="No payment records found."
          />
        </div>
      </TabsContent>

      <TabsContent active={activeTab === "items"}>
        <div className="space-y-4">
          <DailyCheckTableCard
            {...itemsConfig}
            description="Granular view of all individual items purchased by this customer."
            exportFileName={`customer-${customerId}-items`}
            emptyStateMessage="No purchased items found."
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
