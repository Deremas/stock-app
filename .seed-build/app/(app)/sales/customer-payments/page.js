import { jsx as _jsx } from "react/jsx-runtime";
import { CustomerPaymentForm } from "@/components/forms/customer-payment-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getCustomerPaymentFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam } from "@/lib/query-params";
export default async function Page({ searchParams }) {
    const params = await searchParams;
    const customerId = getSingleSearchParam(params, "customerId");
    const initialOpen = getSingleSearchParam(params, "open") === "1";
    const initialSettlementMode = getSingleSearchParam(params, "settlementMode") === "PARTIAL"
        ? "PARTIAL"
        : "FULL";
    const [config, options] = await Promise.all([
        getTablePageConfig("salesCustomerPayments", {
            ...(customerId ? { customerId } : {}),
        }),
        getCustomerPaymentFormOptions(customerId),
    ]);
    return (_jsx(ModalTablePage, { config: config, actionLabel: "Record payment", dialogTitle: "Settle customer credit", dialogDescription: "Post full or partial customer credit payments without leaving this page.", initialOpen: initialOpen, children: _jsx(CustomerPaymentForm, { options: options, ...(customerId ? { initialCustomerId: customerId } : {}), initialSettlementMode: initialSettlementMode }) }));
}
