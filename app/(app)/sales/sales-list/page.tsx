import { SaleForm } from "@/components/forms/sale-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getCurrentUser } from "@/lib/auth/session";
import { getSaleFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type SalesListPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: SalesListPageProps) {
  const params = await searchParams;
  const customerId = getSingleSearchParam(params, "customerId");

  const [user, config, options] = await Promise.all([
    getCurrentUser(),
    getTablePageConfig("salesList", {
      ...(customerId ? { customerId } : {}),
    }),
    getSaleFormOptions(),
  ]);

  return (
    <ModalTablePage
      config={config}
      actionLabel="New sale"
      dialogTitle="New sale"
      dialogDescription="Capture a sale without leaving the sales list."
    >
      <SaleForm
        options={options}
        {...(user?.role ? { userRole: user.role } : {})}
        {...(user?.activeBranchId ? { initialBranchId: user.activeBranchId } : {})}
        mode="modal"
      />
    </ModalTablePage>
  );
}
