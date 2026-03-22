import { SellerAssignmentForm } from "@/components/forms/seller-assignment-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getSellerAssignmentFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type SellerAssignItemsPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: SellerAssignItemsPageProps) {
  const params = await searchParams;
  const initialOpen = getSingleSearchParam(params, "open") === "1";
  const initialBatchId = getSingleSearchParam(params, "batchId");
  const initialSellerId = getSingleSearchParam(params, "sellerId");
  const [config, options] = await Promise.all([
    getTablePageConfig("sellersAssignItems"),
    getSellerAssignmentFormOptions(),
  ]);

  return (
    <ModalTablePage
      config={config}
      actionLabel="New assignment"
      dialogTitle="Assign items to partner"
      dialogDescription="Choose available owned batches, assign quantities, and set the partner remittance price per line."
      initialOpen={initialOpen}
    >
      <SellerAssignmentForm
        options={options}
        {...(initialBatchId ? { initialBatchId } : {})}
        {...(initialSellerId ? { initialSellerId } : {})}
      />
    </ModalTablePage>
  );
}
