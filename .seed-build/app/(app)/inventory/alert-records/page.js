import { jsx as _jsx } from "react/jsx-runtime";
import { TablePage } from "@/components/tables/table-page";
import { getTablePageConfig } from "@/lib/page-data";
export default async function Page() {
    return _jsx(TablePage, { config: await getTablePageConfig("inventoryAlertRecords") });
}
