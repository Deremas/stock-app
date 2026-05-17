import Link from "next/link";
import type { Route } from "next";

import { MetricGrid } from "@/components/dashboard/metric-grid";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell/page-header";
import type { TablePageConfig } from "@/lib/table";

export function TablePage({ config }: { config: TablePageConfig }) {
  const headerProps = {
    title: config.title,
    description: config.description,
    ...(config.eyebrow ? { eyebrow: config.eyebrow } : {}),
  };

  const tableProps = {
    columns: config.columns,
    data: config.rows,
    exportTitle: config.title,
    ...(config.exportFileName ? { exportFileName: config.exportFileName } : {}),
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <PageHeader {...headerProps} />
        </div>
        {config.actionLabel && config.actionHref ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild size="sm" className="rounded-full px-5 shadow-lg">
              <Link href={config.actionHref as Route}>{config.actionLabel}</Link>
            </Button>
          </div>
        ) : null}
      </div>
      {config.kpis?.length ? <MetricGrid metrics={config.kpis} /> : null}
      <Card>
        <CardContent className="p-4">
          <DataTable {...tableProps} />
        </CardContent>
      </Card>
    </>
  );
}
