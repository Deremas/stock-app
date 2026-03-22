import { PurchaseForm } from "@/components/forms/purchase-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getPurchaseFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type PurchasesListPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: PurchasesListPageProps) {
  const params = await searchParams;
  const supplierId = getSingleSearchParam(params, "supplierId");
  const initialBranchId = getSingleSearchParam(params, "branchId");
  const initialProductId = getSingleSearchParam(params, "productId");
  const initialOpen = getSingleSearchParam(params, "open") === "1";

  const [config, options] = await Promise.all([
    getTablePageConfig("purchasesList", {
      ...(supplierId ? { supplierId } : {}),
    }),
    getPurchaseFormOptions(),
  ]);

  return (
    <ModalTablePage
      config={config}
      actionLabel="New purchase"
      dialogTitle="New purchase"
      dialogDescription="Capture a supplier purchase without leaving the purchase list."
      initialOpen={initialOpen}
    >
      <PurchaseForm
        options={options}
        mode="modal"
        {...(initialBranchId ? { initialBranchId } : {})}
        {...(initialProductId ? { initialProductId } : {})}
      />
    </ModalTablePage>
  );
}
