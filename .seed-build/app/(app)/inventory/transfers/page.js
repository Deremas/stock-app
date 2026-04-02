import { jsx as _jsx } from "react/jsx-runtime";
import { TransferForm } from "@/components/forms/transfer-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getTransferFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam } from "@/lib/query-params";
export default async function Page({ searchParams }) {
    const params = await searchParams;
    const initialOpen = getSingleSearchParam(params, "open") === "1";
    const [config, options] = await Promise.all([
        getTablePageConfig("inventoryTransfers"),
        getTransferFormOptions(),
    ]);
    return (_jsx(ModalTablePage, { config: config, actionLabel: "New transfer", dialogTitle: "New transfer", dialogDescription: "Move stock between branches and keep both branch balances in sync.", initialOpen: initialOpen, children: _jsx(TransferForm, { options: options }) }));
}
