import { PageHeader } from "@/components/app-shell/page-header";
import { ReportsHub } from "@/components/reports/reports-hub";
import { getActiveBranchOptions } from "@/lib/form-options";

export default async function ReportsPage() {
  const branches = await getActiveBranchOptions();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reports"
        title="Reports"
        description="Use one simple page to choose the report you want to open."
      />
      <ReportsHub branches={branches} />
    </div>
  );
}
