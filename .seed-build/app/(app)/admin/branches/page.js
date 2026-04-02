import { jsx as _jsx } from "react/jsx-runtime";
import { BranchesManager } from "@/components/admin/branches-manager";
import { getBranchRows } from "@/lib/page-data-purchases-finance-admin";
export default async function BranchesPage() {
    const rows = await getBranchRows();
    return _jsx(BranchesManager, { rows: rows });
}
