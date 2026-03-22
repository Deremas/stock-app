import { SellerSettlementForm } from "@/components/forms/seller-settlement-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getSellerSettlementFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type SellerSettlementsPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: SellerSettlementsPageProps) {
  const params = await searchParams;
  const sellerId = getSingleSearchParam(params, "sellerId");
  const branchId = getSingleSearchParam(params, "branchId");
  const dateFrom = getSingleSearchParam(params, "dateFrom");
  const dateTo = getSingleSearchParam(params, "dateTo");
  const initialOpen = getSingleSearchParam(params, "open") === "1";

  const [config, options] = await Promise.all([
    getTablePageConfig("sellersSettlements", {
      ...(sellerId ? { sellerId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    }),
    getSellerSettlementFormOptions(sellerId, branchId),
  ]);

  return (
    <ModalTablePage
      config={config}
      actionLabel="New payment"
      dialogTitle="Pay partner payable"
      dialogDescription="Select exact sold received-partner lines, enter the birr you are paying for each one, and post the payment to the chosen account."
      initialOpen={initialOpen}
    >
      <SellerSettlementForm
        options={options}
        {...(sellerId ? { initialSellerId: sellerId } : {})}
      />
    </ModalTablePage>
  );
}
