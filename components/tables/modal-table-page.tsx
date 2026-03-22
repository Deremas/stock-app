"use client";

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

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <PageHeader title={config.title} description={config.description} />
        </div>
        <div className="justify-self-end">
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            {actionLabel}
          </Button>
        </div>
      </div>
      {config.kpis?.length ? <MetricGrid metrics={config.kpis} /> : null}
      <Card>
        <CardContent className="p-4">
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
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto p-0">
          <div className="border-b border-border/70 px-4 py-4 sm:px-6">
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>{dialogDescription}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-4 sm:p-6">
            <CreateDialogContext.Provider value={{ close: () => setOpen(false) }}>
              {children}
            </CreateDialogContext.Provider>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
