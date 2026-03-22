import { SellerIntakeForm } from "@/components/forms/seller-intake-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getSellerIntakeFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type SellerIntakeRecordsPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: SellerIntakeRecordsPageProps) {
  const params = await searchParams;
  const sellerId = getSingleSearchParam(params, "sellerId");

  const [config, options] = await Promise.all([
    getTablePageConfig("sellersIntakeRecords", {
      ...(sellerId ? { sellerId } : {}),
    }),
    getSellerIntakeFormOptions(),
  ]);

  return (
    <ModalTablePage
      config={config}
      actionLabel="Receive items"
      dialogTitle="Received From Partner"
      dialogDescription="Record items received from another shop or partner without leaving this page."
    >
      <SellerIntakeForm options={options} mode="modal" />
    </ModalTablePage>
  );
}
