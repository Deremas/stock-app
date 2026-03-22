import { CashTransferForm } from "@/components/forms/cash-transfer-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getCashTransferFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type CashPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: CashPageProps) {
  const params = await searchParams;
  const cashAccountId = getSingleSearchParam(params, "cashAccountId");
  const initialOpen = getSingleSearchParam(params, "open") === "1";

  const [config, options] = await Promise.all([
    getTablePageConfig("financeCash"),
    getCashTransferFormOptions(),
  ]);

  return (
    <ModalTablePage
      config={config}
      actionLabel="Deposit cash"
      dialogTitle="Deposit cash to bank"
      dialogDescription="Move money from a cash account into the correct bank account."
      initialOpen={initialOpen}
    >
      <CashTransferForm
        options={options}
        {...(cashAccountId ? { initialCashAccountId: cashAccountId } : {})}
      />
    </ModalTablePage>
  );
}
