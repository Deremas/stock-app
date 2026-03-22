import { SellerCollectionForm } from "@/components/forms/seller-collection-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getSellerCollectionFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type SellerCollectionsPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: SellerCollectionsPageProps) {
  const params = await searchParams;
  const sellerId = getSingleSearchParam(params, "sellerId");
  const branchId = getSingleSearchParam(params, "branchId");
  const dateFrom = getSingleSearchParam(params, "dateFrom");
  const dateTo = getSingleSearchParam(params, "dateTo");
  const initialOpen = getSingleSearchParam(params, "open") === "1";

  const [config, options] = await Promise.all([
    getTablePageConfig("sellersCollections", {
      ...(sellerId ? { sellerId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    }),
    getSellerCollectionFormOptions(sellerId, branchId),
  ]);

  return (
    <ModalTablePage
      config={config}
      actionLabel="New collection"
      dialogTitle="Collect From Partner"
      dialogDescription="Select exact sold assigned lines and post the cash or bank collection into the receiving account."
      initialOpen={initialOpen}
    >
      <SellerCollectionForm
        options={options}
        {...(sellerId ? { initialSellerId: sellerId } : {})}
      />
    </ModalTablePage>
  );
}
