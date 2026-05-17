"use client";

import * as React from "react";
import { 
  Banknote, 
  HandCoins, 
  History, 
  PackageMinus, 
  PackagePlus, 
  RotateCcw,
  ShoppingBag,
  ListFilter
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

type SellerWorkspaceTabsProps = {
  sellerId: string;
  intakeConfig: TableConfig;
  assignedConfig: TableConfig;
  returnConfig: TableConfig;
  settlementConfig: TableConfig;
  collectionConfig: TableConfig;
  soldItemsConfig: TableConfig;
  hrefs: {
    receive: string;
    assign: string;
    return: string;
    settlement: string;
    collection: string;
    soldItems: string;
  };
  balances: {
    payable: number;
    receivable: number;
  };
};

export function SellerWorkspaceTabs({
  sellerId,
  intakeConfig,
  assignedConfig,
  returnConfig,
  settlementConfig,
  collectionConfig,
  soldItemsConfig,
  hrefs,
  balances
}: SellerWorkspaceTabsProps) {
  const [activeTab, setActiveTab] = React.useState("intake");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <TabsList className="w-full sm:w-auto overflow-x-auto no-scrollbar">
          <TabsTrigger 
            active={activeTab === "intake"} 
            onClick={() => setActiveTab("intake")}
          >
            <PackagePlus className="h-4 w-4" />
            Intake
          </TabsTrigger>
          <TabsTrigger 
            active={activeTab === "assignment"} 
            onClick={() => setActiveTab("assignment")}
          >
            <PackageMinus className="h-4 w-4" />
            Assignment
          </TabsTrigger>
          <TabsTrigger 
            active={activeTab === "sales"} 
            onClick={() => setActiveTab("sales")}
          >
            <ShoppingBag className="h-4 w-4" />
            Sales
          </TabsTrigger>
          <TabsTrigger 
            active={activeTab === "returns"} 
            onClick={() => setActiveTab("returns")}
          >
            <RotateCcw className="h-4 w-4" />
            Returns
          </TabsTrigger>
          <TabsTrigger 
            active={activeTab === "finance"} 
            onClick={() => setActiveTab("finance")}
          >
            <Banknote className="h-4 w-4" />
            Finance
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent active={activeTab === "intake"}>
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button asChild size="sm" className="rounded-xl">
              <a href={hrefs.receive} className="flex items-center gap-2">
                <PackagePlus className="h-4 w-4" />
                Receive items
              </a>
            </Button>
          </div>
          <DailyCheckTableCard
            {...intakeConfig}
            description="Everything this partner brought in, including what remains in branch stock."
            exportFileName={`partner-${sellerId}-received-records`}
            emptyStateMessage="No received records found."
          />
        </div>
      </TabsContent>

      <TabsContent active={activeTab === "assignment"}>
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button asChild size="sm" variant="outline" className="rounded-xl">
              <a href={hrefs.assign} className="flex items-center gap-2">
                <PackageMinus className="h-4 w-4" />
                Assign items
              </a>
            </Button>
          </div>
          <DailyCheckTableCard
            {...assignedConfig}
            description="Items issued from branch stock to this partner."
            exportFileName={`partner-${sellerId}-assigned-items`}
            emptyStateMessage="No assigned-item records found."
          />
        </div>
      </TabsContent>

      <TabsContent active={activeTab === "sales"}>
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button asChild size="sm" variant="outline" className="rounded-xl">
              <a href={hrefs.soldItems} className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                View sold items
              </a>
            </Button>
          </div>
          <DailyCheckTableCard
            {...soldItemsConfig}
            description="Sold item lines linked to this partner."
            exportFileName={`partner-${sellerId}-sold-items`}
            emptyStateMessage="No sold-item lines found."
          />
        </div>
      </TabsContent>

      <TabsContent active={activeTab === "returns"}>
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button asChild size="sm" variant="outline" className="rounded-xl">
              <a href={hrefs.return} className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Record return
              </a>
            </Button>
          </div>
          <DailyCheckTableCard
            {...returnConfig}
            description="Posted returns back to the partner or back into branch stock."
            exportFileName={`partner-${sellerId}-returns`}
            emptyStateMessage="No posted returns found."
          />
        </div>
      </TabsContent>

      <TabsContent active={activeTab === "finance"}>
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3 justify-end">
            <Button
              asChild
              size="sm"
              variant={balances.payable > 0 ? "destructive" : "outline"}
              className="rounded-xl"
            >
              <a href={hrefs.settlement} className="flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Pay partner
              </a>
            </Button>
            <Button
              asChild
              size="sm"
              variant={balances.receivable > 0 ? "default" : "outline"}
              className="rounded-xl"
            >
              <a href={hrefs.collection} className="flex items-center gap-2">
                <HandCoins className="h-4 w-4" />
                Collect birr
              </a>
            </Button>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <DailyCheckTableCard
              {...settlementConfig}
              description="Birr paid out for sold received stock."
              exportFileName={`partner-${sellerId}-payments`}
              emptyStateMessage="No partner payments found."
            />
            <DailyCheckTableCard
              {...collectionConfig}
              description="Birr collected for sold assigned items."
              exportFileName={`partner-${sellerId}-collections`}
              emptyStateMessage="No partner collections found."
            />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
