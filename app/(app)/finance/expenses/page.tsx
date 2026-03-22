import { ExpenseForm } from "@/components/forms/expense-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getExpenseFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";

export default async function Page() {
  const [config, options] = await Promise.all([
    getTablePageConfig("financeExpenses"),
    getExpenseFormOptions(),
  ]);

  return (
    <ModalTablePage
      config={config}
      actionLabel="New expense"
      dialogTitle="New expense"
      dialogDescription="Post an expense and deduct it from the selected branch account."
    >
      <ExpenseForm options={options} />
    </ModalTablePage>
  );
}
