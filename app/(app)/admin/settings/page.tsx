import { PageHeader } from "@/components/app-shell/page-header";
import { BusinessSettingsForm } from "@/components/forms/business-settings-form";
import { getBusinessSettings } from "@/lib/business-settings";

export default async function Page() {
  const settings = await getBusinessSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Business settings"
        description="Control optional VAT behaviour. VAT is disabled by default and can be enabled independently for sales and purchases."
      />
      <BusinessSettingsForm settings={settings} />
    </div>
  );
}
