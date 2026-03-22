import { PartnerForm } from "@/components/forms/partner-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getTablePageConfig } from "@/lib/page-data";

export default async function Page() {
  const config = await getTablePageConfig("sellersList");

  return (
    <ModalTablePage
      config={config}
      actionLabel="New partner"
      dialogTitle="New partner"
      dialogDescription="Create a partner with phone, location, and note details for easier identification."
    >
      <PartnerForm closeCreateDialogOnSuccess />
    </ModalTablePage>
  );
}
