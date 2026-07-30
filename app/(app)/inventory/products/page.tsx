import type { RowActionConfig, SimpleRow } from "@/lib/table";

import { ProductForm } from "@/components/forms/product-form";
import { ProductDeleteDialog } from "@/components/inventory/product-delete-dialog";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { TablePage } from "@/components/tables/table-page";
import { getCurrentUser } from "@/lib/auth/session";
import { getTablePageConfig } from "@/lib/page-data";
import { prisma } from "@/lib/prisma";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";
import { hasPermission } from "@/lib/rbac";
import { normalizeProductUnit } from "@/lib/product-units";

type ProductsPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

function createDeleteItemHref(productId: string) {
  const params = new URLSearchParams({
    deleteProductId: productId,
    delete: "1",
  });

  return `/inventory/products?${params.toString()}`;
}

export default async function Page({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const initialDeleteOpen = getSingleSearchParam(params, "delete") === "1";
  const initialOpen = getSingleSearchParam(params, "open") === "1" && !initialDeleteOpen;
  const productId = getSingleSearchParam(params, "productId");
  const deleteProductId = getSingleSearchParam(params, "deleteProductId");
  const isEdit = getSingleSearchParam(params, "mode") === "edit" && Boolean(productId);
  const importMode = getSingleSearchParam(params, "import");
  const initialMode = importMode === "excel" ? "EXCEL" : importMode === "bulk" ? "BULK" : "SINGLE";

  const [config, user] = await Promise.all([getTablePageConfig("inventoryProducts"), getCurrentUser()]);
  const canDelete = user?.role === "ADMIN";
  const [product, deleteProduct] = await Promise.all([
    isEdit && productId
      ? prisma.product.findUnique({
          where: {
            id: productId,
          },
          select: {
            id: true,
            name: true,
            minimumStockAlert: true,
            unit: true,
            description: true,
          },
        })
      : null,
    canDelete && deleteProductId
      ? prisma.product.findUnique({
          where: {
            id: deleteProductId,
          },
          select: {
            id: true,
            name: true,
          },
        })
      : null,
  ]);

  const configWithDelete =
    canDelete
      ? {
          ...config,
          rows: config.rows.map(
            (row) =>
              ({
                ...row,
                __actions: [
                  ...((row.__actions ?? []) as RowActionConfig[]),
                  {
                    key: "delete",
                    label: "Delete",
                    href: createDeleteItemHref(row.id),
                    icon: "trash",
                    variant: "destructive",
                  },
                ],
              }) satisfies SimpleRow,
          ),
        }
      : config;

  if (!user || !hasPermission(user.role, "inventory:manage")) {
    return <TablePage config={configWithDelete} />;
  }

  return (
    <>
      <ModalTablePage
        config={configWithDelete}
        actionLabel="New item"
        dialogTitle={product ? "Edit item" : "New item"}
        dialogDescription={
          product ? "Update item details without leaving the list." : "Create an item record."
        }
        initialOpen={initialOpen}
      >
        <ProductForm
          mode="modal"
          intent={product ? "edit" : "create"}
          initialMode={initialMode}
          {...(product
            ? {
                initialValues: {
                  id: product.id,
                  name: product.name,
                  minimumStockAlert: product.minimumStockAlert,
                  unit: normalizeProductUnit(product.unit),
                  description: product.description ?? "",
                },
              }
            : {})}
        />
      </ModalTablePage>
      <ProductDeleteDialog product={deleteProduct} open={initialDeleteOpen && canDelete} />
    </>
  );
}
