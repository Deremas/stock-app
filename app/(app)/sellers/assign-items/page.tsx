import { SellerAssignmentForm } from "@/components/forms/seller-assignment-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getCurrentUser } from "@/lib/auth/session";
import { getSellerAssignmentFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type SellerAssignItemsPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: SellerAssignItemsPageProps) {
  const params = await searchParams;
  const initialOpen = getSingleSearchParam(params, "open") === "1";
  const initialBatchId = getSingleSearchParam(params, "batchId");
  const initialSellerId = getSingleSearchParam(params, "sellerId");
  const [user, config, options] = await Promise.all([
    getCurrentUser(),
    getTablePageConfig("sellersAssignItems"),
    getSellerAssignmentFormOptions(),
  ]);

  return (
    <ModalTablePage
      config={config}
      actionLabel="New assignment"
      dialogTitle="New assignment"
      dialogDescription="Choose available items, assign quantities, and set the seller remittance price per line."
      initialOpen={initialOpen}
    >
      <SellerAssignmentForm
        options={options}
        {...(user?.role ? { userRole: user.role } : {})}
        {...(initialBatchId ? { initialBatchId } : {})}
        {...(initialSellerId ? { initialSellerId } : {})}
      />
    </ModalTablePage>
  );
}
