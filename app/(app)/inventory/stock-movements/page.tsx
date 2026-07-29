import { TablePage } from "@/components/tables/table-page";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type StockMovementsPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: StockMovementsPageProps) {
  const params = await searchParams;
  const productId = getSingleSearchParam(params, "productId");
  const branchId = getSingleSearchParam(params, "branchId");

  return <TablePage config={await getTablePageConfig("inventoryStockMovements", { productId, branchId })} />;
}
