import { TablePage } from "@/components/tables/table-page";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type SellerReportsPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: SellerReportsPageProps) {
  const params = await searchParams;
  const branchId = getSingleSearchParam(params, "branchId");

  return (
    <TablePage
      config={await getTablePageConfig("reportsSellers", {
        ...(branchId ? { branchId } : {}),
      })}
    />
  );
}
