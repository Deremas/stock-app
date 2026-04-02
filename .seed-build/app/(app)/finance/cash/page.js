import { jsx as _jsx } from "react/jsx-runtime";
import { CashTransferForm } from "@/components/forms/cash-transfer-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getCashTransferFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam } from "@/lib/query-params";
export default async function Page({ searchParams }) {
    const params = await searchParams;
    const cashAccountId = getSingleSearchParam(params, "cashAccountId");
    const initialOpen = getSingleSearchParam(params, "open") === "1";
    const [config, options] = await Promise.all([
        getTablePageConfig("financeCash"),
        getCashTransferFormOptions(),
    ]);
    return (_jsx(ModalTablePage, { config: config, actionLabel: "Deposit cash", dialogTitle: "Deposit cash to bank", dialogDescription: "Move money from a cash account into the correct bank account.", initialOpen: initialOpen, children: _jsx(CashTransferForm, { options: options, ...(cashAccountId ? { initialCashAccountId: cashAccountId } : {}) }) }));
}
