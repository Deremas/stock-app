import { jsx as _jsx } from "react/jsx-runtime";
import { TablePage } from "@/components/tables/table-page";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam } from "@/lib/query-params";
export default async function Page({ searchParams }) {
    const params = await searchParams;
    const customerId = getSingleSearchParam(params, "customerId");
    return (_jsx(TablePage, { config: await getTablePageConfig("salesCustomerCredit", {
            ...(customerId ? { customerId } : {}),
        }) }));
}
