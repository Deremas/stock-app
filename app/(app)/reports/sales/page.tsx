import { TablePage } from "@/components/tables/table-page";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type SalesReportsPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: SalesReportsPageProps) {
  const params = await searchParams;
  const branchId = getSingleSearchParam(params, "branchId");
  const dateFrom = getSingleSearchParam(params, "dateFrom");
  const dateTo = getSingleSearchParam(params, "dateTo");

  return (
    <TablePage
      config={await getTablePageConfig("reportsSales", {
        ...(branchId ? { branchId } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
      })}
    />
  );
}
