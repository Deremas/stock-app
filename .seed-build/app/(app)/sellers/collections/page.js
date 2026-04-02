import { jsx as _jsx } from "react/jsx-runtime";
import { SellerCollectionForm } from "@/components/forms/seller-collection-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getSellerCollectionFormOptions } from "@/lib/form-options";
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
        getTablePageConfig("sellersCollections", {
            ...(sellerId ? { sellerId } : {}),
            ...(branchId ? { branchId } : {}),
            ...(dateFrom ? { dateFrom } : {}),
            ...(dateTo ? { dateTo } : {}),
        }),
        getSellerCollectionFormOptions(sellerId, branchId),
    ]);
    return (_jsx(ModalTablePage, { config: config, actionLabel: "New collection", dialogTitle: "Collect From Partner", dialogDescription: "Select exact sold assigned lines and post the cash or bank collection into the receiving account.", initialOpen: initialOpen, children: _jsx(SellerCollectionForm, { options: options, ...(sellerId ? { initialSellerId: sellerId } : {}) }) }));
}
