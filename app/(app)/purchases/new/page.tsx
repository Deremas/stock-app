import { PageHeader } from "@/components/app-shell/page-header";
import { PurchaseForm } from "@/components/forms/purchase-form";
import { getPurchaseFormOptions } from "@/lib/form-options";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type NewPurchasePageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function NewPurchasePage({ searchParams }: NewPurchasePageProps) {
  const params = await searchParams;
  const initialBranchId = getSingleSearchParam(params, "branchId");
  const initialProductId = getSingleSearchParam(params, "productId");
  const options = await getPurchaseFormOptions();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Purchases"
        title="New Purchase"
        description="Capture supplier purchases that increase owned stock and establish payable balances."
      />
      <PurchaseForm
        options={options}
        {...(initialBranchId ? { initialBranchId } : {})}
        {...(initialProductId ? { initialProductId } : {})}
        cancelHref="/purchases/list"
      />
    </div>
  );
}
