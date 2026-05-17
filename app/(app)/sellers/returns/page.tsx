import { SellerReturnForm } from "@/components/forms/seller-return-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getSellerReturnFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type SellerReturnsPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: SellerReturnsPageProps) {
  const params = await searchParams;
  const sellerId = getSingleSearchParam(params, "sellerId");
  const branchId = getSingleSearchParam(params, "branchId");
  const dateFrom = getSingleSearchParam(params, "dateFrom");
  const dateTo = getSingleSearchParam(params, "dateTo");
  const intakeItemId = getSingleSearchParam(params, "intakeItemId");
  const assignmentItemId = getSingleSearchParam(params, "assignmentItemId");

  const [config, options] = await Promise.all([
    getTablePageConfig("sellersReturns", {
      ...(sellerId ? { sellerId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    }),
    getSellerReturnFormOptions(sellerId),
  ]);

  const initialOpen = !!(intakeItemId || assignmentItemId);

  return (
    <ModalTablePage
      config={config}
      actionLabel="Record return"
      dialogTitle="Record Partner Return"
      dialogDescription="Select exact unsold lines to return back to the partner or back into branch stock."
      initialOpen={initialOpen}
    >
      <SellerReturnForm
        options={options}
        {...(sellerId ? { initialSellerId: sellerId } : {})}
        {...(intakeItemId ? { initialIntakeItemId: intakeItemId } : {})}
        {...(assignmentItemId ? { initialAssignmentItemId: assignmentItemId } : {})}
      />
    </ModalTablePage>
  );
}
