import { jsx as _jsx } from "react/jsx-runtime";
import { SellerAssignmentForm } from "@/components/forms/seller-assignment-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getSellerAssignmentFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam } from "@/lib/query-params";
export default async function Page({ searchParams }) {
    const params = await searchParams;
    const initialOpen = getSingleSearchParam(params, "open") === "1";
    const initialBatchId = getSingleSearchParam(params, "batchId");
    const initialSellerId = getSingleSearchParam(params, "sellerId");
    const [config, options] = await Promise.all([
        getTablePageConfig("sellersAssignItems"),
        getSellerAssignmentFormOptions(),
    ]);
    return (_jsx(ModalTablePage, { config: config, actionLabel: "New assignment", dialogTitle: "Assign items to partner", dialogDescription: "Choose available owned batches, assign quantities, and set the partner remittance price per line.", initialOpen: initialOpen, children: _jsx(SellerAssignmentForm, { options: options, ...(initialBatchId ? { initialBatchId } : {}), ...(initialSellerId ? { initialSellerId } : {}) }) }));
}
