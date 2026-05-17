import { PageHeader } from "@/components/app-shell/page-header";
import { SaleForm } from "@/components/forms/sale-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getSaleFormOptions } from "@/lib/form-options";

type NewSalePageProps = {
  searchParams?: Promise<{
    productId?: string;
    branchId?: string;
  }>;
};

export default async function NewSalePage({ searchParams }: NewSalePageProps) {
  const params = (await searchParams) ?? {};
  const [user, options] = await Promise.all([
    getCurrentUser(),
    getSaleFormOptions(),
  ]);

  const initialProductId =
    typeof params.productId === "string" ? params.productId : undefined;
  const initialBranchId =
    typeof params.branchId === "string" ? params.branchId : user?.activeBranchId;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sales"
        title="New Sale"
        description="Capture a fast sale with optional walk-in customer, branch stock validation, and receipt totals."
      />
      <SaleForm
        options={options}
        {...(user?.role ? { userRole: user.role } : {})}
        {...(initialProductId ? { initialProductId } : {})}
        {...(initialBranchId ? { initialBranchId } : {})}
        cancelHref="/sales/sales-list"
      />
    </div>
  );
}
