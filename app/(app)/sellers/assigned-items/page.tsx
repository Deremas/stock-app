import { TablePage } from "@/components/tables/table-page";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type SellerAssignedItemsPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: SellerAssignedItemsPageProps) {
  const params = await searchParams;
  const sellerId = getSingleSearchParam(params, "sellerId");
  const branchId = getSingleSearchParam(params, "branchId");

  return (
    <TablePage
      config={await getTablePageConfig("sellersAssignedItems", {
        ...(sellerId ? { sellerId } : {}),
        ...(branchId ? { branchId } : {}),
      })}
    />
  );
}
