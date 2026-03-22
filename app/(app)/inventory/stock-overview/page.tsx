import { PageHeader } from "@/components/app-shell/page-header";
import { OwnedStockBatchDialog } from "@/components/inventory/owned-stock-batch-dialog";
import { DataTable } from "@/components/tables/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getOwnedStockBatches } from "@/lib/owned-stock-batches";
import { getTablePageConfig } from "@/lib/page-data";
import { prisma } from "@/lib/prisma";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type StockOverviewPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: StockOverviewPageProps) {
  const params = await searchParams;
  const openBatches = getSingleSearchParam(params, "openBatches") === "1";
  const productId = getSingleSearchParam(params, "productId");
  const branchId = getSingleSearchParam(params, "branchId");

  const [config, currentUser] = await Promise.all([
    getTablePageConfig("inventoryStockOverview"),
    getCurrentUser(),
  ]);

  const canAccessBranch = Boolean(
    branchId && currentUser?.branches.some((branch) => branch.id === branchId),
  );
  const shouldLoadBatchDialog =
    openBatches && Boolean(productId) && Boolean(branchId) && canAccessBranch;

  const [selectedProduct, selectedBranch, ownedBatches] = shouldLoadBatchDialog
    ? await Promise.all([
        prisma.product.findUnique({
          where: {
            id: productId!,
          },
          select: {
            name: true,
          },
        }),
        prisma.branch.findUnique({
          where: {
            id: branchId!,
          },
          select: {
            name: true,
          },
        }),
        getOwnedStockBatches({
          productId: productId!,
          branchIds: [branchId!],
        }),
      ])
    : [null, null, []];

  return (
    <>
      <PageHeader title={config.title} description={config.description} />
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
      <OwnedStockBatchDialog
        open={openBatches}
        productName={selectedProduct?.name}
        branchName={selectedBranch?.name}
        batches={ownedBatches}
        canEdit={currentUser?.role === "ADMIN"}
      />
    </>
  );
}
