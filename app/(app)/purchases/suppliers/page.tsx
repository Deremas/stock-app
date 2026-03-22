import { SupplierForm } from "@/components/forms/supplier-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getTablePageConfig } from "@/lib/page-data";

export default async function Page() {
  const config = await getTablePageConfig("purchasesSuppliers");

  return (
    <ModalTablePage
      config={config}
      actionLabel="New supplier"
      dialogTitle="New supplier"
      dialogDescription="Create a supplier with the details needed to distinguish them clearly."
    >
      <SupplierForm closeCreateDialogOnSuccess />
    </ModalTablePage>
  );
}
