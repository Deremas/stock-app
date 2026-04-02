import { jsx as _jsx } from "react/jsx-runtime";
import { SellerReturnForm } from "@/components/forms/seller-return-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getSellerReturnFormOptions } from "@/lib/form-options";
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
        getTablePageConfig("sellersReturns", {
            ...(sellerId ? { sellerId } : {}),
            ...(branchId ? { branchId } : {}),
            ...(dateFrom ? { dateFrom } : {}),
            ...(dateTo ? { dateTo } : {}),
        }),
        getSellerReturnFormOptions(sellerId),
    ]);
    return (_jsx(ModalTablePage, { config: config, actionLabel: "Record return", dialogTitle: "Record Partner Return", dialogDescription: "Select exact unsold lines to return back to the partner or back into branch stock.", initialOpen: initialOpen, children: _jsx(SellerReturnForm, { options: options, ...(sellerId ? { initialSellerId: sellerId } : {}) }) }));
}
