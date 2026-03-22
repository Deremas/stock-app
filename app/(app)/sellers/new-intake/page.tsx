import { PageHeader } from "@/components/app-shell/page-header";
import { SellerIntakeForm } from "@/components/forms/seller-intake-form";
import { getSellerIntakeFormOptions } from "@/lib/form-options";

export default async function NewSellerIntakePage() {
  const options = await getSellerIntakeFormOptions();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Partners"
        title="Received From Partner"
        description="Record items received from another shop or partner using item name, quantity, and partner price."
      />
      <SellerIntakeForm options={options} cancelHref="/sellers/intake-records" />
    </div>
  );
}
