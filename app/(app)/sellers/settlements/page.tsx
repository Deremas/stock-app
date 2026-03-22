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
  const initialOpen = getSingleSearchParam(params, "open") === "1";

  const [config, options] = await Promise.all([
    getTablePageConfig("sellersSettlements", {
      ...(sellerId ? { sellerId } : {}),
    }),
    getSellerSettlementFormOptions(sellerId),
  ]);

  return (
    <ModalTablePage
      config={config}
      actionLabel="New payment"
      dialogTitle="Pay partner payable"
      dialogDescription="Post full or partial partner settlements without leaving this page."
      initialOpen={initialOpen}
    >
      <SellerSettlementForm
        options={options}
        {...(sellerId ? { initialSellerId: sellerId } : {})}
      />
    </ModalTablePage>
  );
}
