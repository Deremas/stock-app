import { FinanceAccountForm } from "@/components/forms/finance-account-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getFinanceAccountFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";

export default async function Page() {
  const [config, options] = await Promise.all([
    getTablePageConfig("financeAccounts"),
    getFinanceAccountFormOptions(),
  ]);

  return (
    <ModalTablePage
      config={config}
      actionLabel="New account"
      dialogTitle="New finance account"
      dialogDescription="Create a bank or cash account with an optional opening balance."
    >
      <FinanceAccountForm options={options} />
    </ModalTablePage>
  );
}
