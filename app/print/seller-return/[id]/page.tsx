import { notFound } from "next/navigation";
import { getSellerReturnDetail } from "@/lib/page-data-sellers";
import { PrintReturnClient } from "./print-return-client";

type PrintReturnPageProps = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: PrintReturnPageProps) {
  const { id } = await params;
  const data = await getSellerReturnDetail(id);

  if (!data) {
    return notFound();
  }

  return <PrintReturnClient data={data as any} />;
}
