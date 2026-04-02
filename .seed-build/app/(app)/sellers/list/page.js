import { jsx as _jsx } from "react/jsx-runtime";
import { PartnerForm } from "@/components/forms/partner-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getTablePageConfig } from "@/lib/page-data";
export default async function Page() {
    const config = await getTablePageConfig("sellersList");
    return (_jsx(ModalTablePage, { config: config, actionLabel: "New partner", dialogTitle: "New partner", dialogDescription: "Create a partner with phone, location, and note details for easier identification.", children: _jsx(PartnerForm, { closeCreateDialogOnSuccess: true }) }));
}
