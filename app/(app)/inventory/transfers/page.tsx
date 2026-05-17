import { TransferForm } from "@/components/forms/transfer-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getTransferFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type TransfersPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: TransfersPageProps) {
  const params = await searchParams;
  const initialOpen = getSingleSearchParam(params, "open") === "1";
  const initialProductId = getSingleSearchParam(params, "productId");
  const initialSourceBranchId = getSingleSearchParam(params, "fromBranchId");

  const [config, options] = await Promise.all([
    getTablePageConfig("inventoryTransfers"),
    getTransferFormOptions(),
  ]);

  return (
    <ModalTablePage
      config={config}
      actionLabel="New transfer"
      dialogTitle="New transfer"
      dialogDescription="Move stock between branches and keep both branch balances in sync."
      initialOpen={initialOpen}
    >
      <TransferForm
        options={options}
        {...(initialProductId ? { initialProductId } : {})}
        {...(initialSourceBranchId ? { initialSourceBranchId } : {})}
      />
    </ModalTablePage>
  );
}
