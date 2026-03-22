import { SaleForm } from "@/components/forms/sale-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getSaleFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type SalesListPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: SalesListPageProps) {
  const params = await searchParams;
  const customerId = getSingleSearchParam(params, "customerId");

  const [config, options] = await Promise.all([
    getTablePageConfig("salesList", {
      ...(customerId ? { customerId } : {}),
    }),
    getSaleFormOptions(),
  ]);

  return (
    <ModalTablePage
      config={config}
      actionLabel="New sale"
      dialogTitle="New sale"
      dialogDescription="Capture a sale without leaving the sales list."
    >
      <SaleForm options={options} mode="modal" />
    </ModalTablePage>
  );
}
