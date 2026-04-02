import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { PageHeader } from "@/components/app-shell/page-header";
import { SaleForm } from "@/components/forms/sale-form";
import { getSaleFormOptions } from "@/lib/form-options";
export default async function NewSalePage({ searchParams }) {
    const params = (await searchParams) ?? {};
    const options = await getSaleFormOptions();
    const initialProductId = typeof params.productId === "string" ? params.productId : undefined;
    const initialBranchId = typeof params.branchId === "string" ? params.branchId : undefined;
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(PageHeader, { eyebrow: "Sales", title: "New Sale", description: "Capture a fast sale with optional walk-in customer, branch stock validation, and receipt totals." }), _jsx(SaleForm, { options: options, ...(initialProductId ? { initialProductId } : {}), ...(initialBranchId ? { initialBranchId } : {}), cancelHref: "/sales/sales-list" })] }));
}
