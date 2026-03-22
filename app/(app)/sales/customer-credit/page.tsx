import { TablePage } from "@/components/tables/table-page";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type CustomerCreditPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: CustomerCreditPageProps) {
  const params = await searchParams;
  const customerId = getSingleSearchParam(params, "customerId");

  return (
    <TablePage
      config={await getTablePageConfig("salesCustomerCredit", {
        ...(customerId ? { customerId } : {}),
      })}
    />
  );
}
