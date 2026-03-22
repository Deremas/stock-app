import { CustomerForm } from "@/components/forms/customer-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getTablePageConfig } from "@/lib/page-data";

export default async function Page() {
  const config = await getTablePageConfig("salesCustomers");

  return (
    <ModalTablePage
      config={config}
      actionLabel="New customer"
      dialogTitle="New customer"
      dialogDescription="Create a customer and capture details that distinguish them from walk-in sales."
    >
      <CustomerForm closeCreateDialogOnSuccess />
    </ModalTablePage>
  );
}
