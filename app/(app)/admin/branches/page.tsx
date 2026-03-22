import { BranchesManager } from "@/components/admin/branches-manager";
import { getBranchRows } from "@/lib/page-data-purchases-finance-admin";

export default async function BranchesPage() {
  const rows = await getBranchRows();

  return <BranchesManager rows={rows} />;
}
