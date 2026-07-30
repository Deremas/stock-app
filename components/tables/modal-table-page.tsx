"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { TablePageConfig } from "@/lib/table";

type CreateDialogControls = {
  close: () => void;
};

const CreateDialogContext = createContext<CreateDialogControls | null>(null);

export function useCreateDialog() {
  return useContext(CreateDialogContext);
}

type ModalTablePageProps = {
  config: TablePageConfig;
  actionLabel: string;
  dialogTitle: string;
  dialogDescription: string;
  initialOpen?: boolean;
  children: React.ReactNode;
};

export function ModalTablePage({
  config,
  actionLabel,
  dialogTitle,
  dialogDescription,
  initialOpen = false,
  children,
}: ModalTablePageProps) {
  const [open, setOpen] = useState(initialOpen);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTabChange = (tabKey: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const tabParam = config.tabParam || "flow";
    
    if (tabKey === "ALL") {
      params.delete(tabParam);
    } else {
      params.set(tabParam, tabKey);
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <PageHeader title={config.title} description={config.description} />
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
          {config.secondaryActionLabel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden rounded-xl px-4 shadow-sm sm:flex"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("open", "1");
                if (config.secondaryActionParam && config.secondaryActionValue) {
                  params.set(config.secondaryActionParam, config.secondaryActionValue);
                }
                router.push(`?${params.toString()}`);
              }}
            >
              {config.secondaryActionLabel.toLowerCase().includes("import") || config.secondaryActionLabel.toLowerCase().includes("excel") ? (
                <Plus className="mr-2 h-4 w-4 rotate-45" /> // Using a modified plus or file icon
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {config.secondaryActionLabel}
            </Button>
          )}
          <Button type="button" size="sm" className="min-w-0 flex-1 rounded-xl px-4 shadow-sm sm:flex-none" onClick={() => {
            setOpen(true);
          }}>
            <Plus className="h-4 w-4" />
            {actionLabel}
          </Button>
        </div>
      </div>
      {config.kpis?.length ? <MetricGrid metrics={config.kpis} /> : null}
      
      {config.tabs?.length ? (
        <Tabs className="mb-6">
          <TabsList>
            {config.tabs.map((tab) => (
              <TabsTrigger
                key={tab.key}
                active={config.activeTab === tab.key}
                onClick={() => handleTabChange(tab.key)}
              >
                {tab.label}
                {tab.count !== undefined ? (
                  <span className={cn(
                    "ml-2 rounded-full px-1.5 py-0.5 text-[10px]",
                    config.activeTab === tab.key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted-foreground/10 text-muted-foreground"
                  )}>
                    {tab.count}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      <Card className="border border-border/70 bg-card shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <DataTable
            columns={config.columns}
            data={config.rows}
            exportTitle={config.title}
            {...(config.exportFileName
              ? { exportFileName: config.exportFileName }
              : {})}
          />
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="grid max-h-[calc(100svh-2rem)] max-w-3xl grid-rows-[auto_1fr] overflow-hidden p-0">
          <div className="border-b border-border/70 bg-card px-4 py-4 sm:px-6">
            <DialogHeader>
              <DialogTitle className="text-xl">{dialogTitle}</DialogTitle>
              <DialogDescription>{dialogDescription}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
            <CreateDialogContext.Provider value={{ close: () => setOpen(false) }}>
              {children}
            </CreateDialogContext.Provider>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
