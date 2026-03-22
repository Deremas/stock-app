import { TablePage } from "@/components/tables/table-page";
import { getTablePageConfig } from "@/lib/page-data";

export default async function Page() {
  return <TablePage config={await getTablePageConfig("financeLedger")} />;
}
