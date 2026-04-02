import { jsx as _jsx } from "react/jsx-runtime";
import { TablePage } from "@/components/tables/table-page";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam } from "@/lib/query-params";
export default async function Page({ searchParams }) {
    const params = await searchParams;
    const branchId = getSingleSearchParam(params, "branchId");
    const dateFrom = getSingleSearchParam(params, "dateFrom");
    const dateTo = getSingleSearchParam(params, "dateTo");
    return (_jsx(TablePage, { config: await getTablePageConfig("reportsFinance", {
            ...(branchId ? { branchId } : {}),
            ...(dateFrom ? { dateFrom } : {}),
            ...(dateTo ? { dateTo } : {}),
        }) }));
}
