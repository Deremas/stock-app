import { jsx as _jsx } from "react/jsx-runtime";
import { SellerIntakeForm } from "@/components/forms/seller-intake-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getSellerIntakeFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam } from "@/lib/query-params";
export default async function Page({ searchParams }) {
    const params = await searchParams;
    const sellerId = getSingleSearchParam(params, "sellerId");
    const branchId = getSingleSearchParam(params, "branchId");
    const dateFrom = getSingleSearchParam(params, "dateFrom");
    const dateTo = getSingleSearchParam(params, "dateTo");
    const initialOpen = getSingleSearchParam(params, "open") === "1";
    const [config, options] = await Promise.all([
        getTablePageConfig("sellersIntakeRecords", {
            ...(sellerId ? { sellerId } : {}),
            ...(branchId ? { branchId } : {}),
            ...(dateFrom ? { dateFrom } : {}),
            ...(dateTo ? { dateTo } : {}),
        }),
        getSellerIntakeFormOptions(),
    ]);
    return (_jsx(ModalTablePage, { config: config, actionLabel: "Receive items", dialogTitle: "Received From Partner", dialogDescription: "Record items received from another shop or partner without leaving this page.", initialOpen: initialOpen, children: _jsx(SellerIntakeForm, { options: options, mode: "modal", ...(sellerId ? { initialSellerId: sellerId } : {}) }) }));
}
