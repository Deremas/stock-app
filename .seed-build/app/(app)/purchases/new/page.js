import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { PageHeader } from "@/components/app-shell/page-header";
import { PurchaseForm } from "@/components/forms/purchase-form";
import { getPurchaseFormOptions } from "@/lib/form-options";
import { getSingleSearchParam } from "@/lib/query-params";
export default async function NewPurchasePage({ searchParams }) {
    const params = await searchParams;
    const initialBranchId = getSingleSearchParam(params, "branchId");
    const initialProductId = getSingleSearchParam(params, "productId");
    const options = await getPurchaseFormOptions();
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(PageHeader, { eyebrow: "Purchases", title: "New Purchase", description: "Capture purchases that increase owned stock. Supplier is optional for fully paid direct purchases, and required for payable tracking." }), _jsx(PurchaseForm, { options: options, ...(initialBranchId ? { initialBranchId } : {}), ...(initialProductId ? { initialProductId } : {}), cancelHref: "/purchases/list" })] }));
}
