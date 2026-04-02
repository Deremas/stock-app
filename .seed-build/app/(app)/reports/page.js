import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { PageHeader } from "@/components/app-shell/page-header";
import { ReportsHub } from "@/components/reports/reports-hub";
import { getActiveBranchOptions } from "@/lib/form-options";
export default async function ReportsPage() {
    const branches = await getActiveBranchOptions();
    return (_jsxs("div", { className: "space-y-5", children: [_jsx(PageHeader, { eyebrow: "Reports", title: "Reports", description: "Use one simple page to choose the report you want to open." }), _jsx(ReportsHub, { branches: branches })] }));
}
