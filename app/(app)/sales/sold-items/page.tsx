import { TablePage } from "@/components/tables/table-page";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type SoldItemsPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: SoldItemsPageProps) {
  const params = await searchParams;
  const customerId = getSingleSearchParam(params, "customerId");
  const sellerId = getSingleSearchParam(params, "sellerId");
  const branchId = getSingleSearchParam(params, "branchId");
  const dateFrom = getSingleSearchParam(params, "dateFrom");
  const dateTo = getSingleSearchParam(params, "dateTo");

  return (
    <TablePage
      config={await getTablePageConfig("salesSoldItems", {
        ...(customerId ? { customerId } : {}),
        ...(sellerId ? { sellerId } : {}),
        ...(branchId ? { branchId } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
      })}
    />
  );
}
