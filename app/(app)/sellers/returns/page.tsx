import { TablePage } from "@/components/tables/table-page";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type SellerReturnsPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: SellerReturnsPageProps) {
  const params = await searchParams;
  const sellerId = getSingleSearchParam(params, "sellerId");

  return (
    <TablePage
      config={await getTablePageConfig("sellersReturns", {
        ...(sellerId ? { sellerId } : {}),
      })}
    />
  );
}
