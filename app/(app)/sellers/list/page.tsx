import { SellerForm } from "@/components/forms/seller-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getTablePageConfig } from "@/lib/page-data";

export default async function Page() {
  const config = await getTablePageConfig("sellersList");

  return (
    <ModalTablePage
      config={config}
      actionLabel="New seller"
      dialogTitle="New seller"
      dialogDescription="Create a seller with phone, location, and note details for easier identification."
    >
      <SellerForm closeCreateDialogOnSuccess />
    </ModalTablePage>
  );
}
