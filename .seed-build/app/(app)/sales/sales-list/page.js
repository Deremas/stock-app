import { jsx as _jsx } from "react/jsx-runtime";
import { SaleForm } from "@/components/forms/sale-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getSaleFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam } from "@/lib/query-params";
export default async function Page({ searchParams }) {
    const params = await searchParams;
    const customerId = getSingleSearchParam(params, "customerId");
    const [config, options] = await Promise.all([
        getTablePageConfig("salesList", {
            ...(customerId ? { customerId } : {}),
        }),
        getSaleFormOptions(),
    ]);
    return (_jsx(ModalTablePage, { config: config, actionLabel: "New sale", dialogTitle: "New sale", dialogDescription: "Capture a sale without leaving the sales list.", children: _jsx(SaleForm, { options: options, mode: "modal" }) }));
}
