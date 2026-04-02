import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { PageHeader } from "@/components/app-shell/page-header";
import { SellerIntakeForm } from "@/components/forms/seller-intake-form";
import { getSellerIntakeFormOptions } from "@/lib/form-options";
import { getSingleSearchParam } from "@/lib/query-params";
export default async function NewSellerIntakePage({ searchParams, }) {
    const params = await searchParams;
    const sellerId = getSingleSearchParam(params, "sellerId");
    const options = await getSellerIntakeFormOptions();
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(PageHeader, { eyebrow: "Partners", title: "Received From Partner", description: "Record items received from another shop or partner using item name, quantity, and partner price." }), _jsx(SellerIntakeForm, { options: options, cancelHref: "/sellers/intake-records", ...(sellerId ? { initialSellerId: sellerId } : {}) })] }));
}
