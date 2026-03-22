import { PageHeader } from "@/components/app-shell/page-header";
import { SellerIntakeForm } from "@/components/forms/seller-intake-form";
import { getSellerIntakeFormOptions } from "@/lib/form-options";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type NewSellerIntakePageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function NewSellerIntakePage({
  searchParams,
}: NewSellerIntakePageProps) {
  const params = await searchParams;
  const sellerId = getSingleSearchParam(params, "sellerId");
  const options = await getSellerIntakeFormOptions();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Partners"
        title="Received From Partner"
        description="Record items received from another shop or partner using item name, quantity, and partner price."
      />
      <SellerIntakeForm
        options={options}
        cancelHref="/sellers/intake-records"
        {...(sellerId ? { initialSellerId: sellerId } : {})}
      />
    </div>
  );
}
