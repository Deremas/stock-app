import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { ProductForm } from "@/components/forms/product-form";
import { ProductDeleteDialog } from "@/components/inventory/product-delete-dialog";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { TablePage } from "@/components/tables/table-page";
import { getCurrentUser } from "@/lib/auth/session";
import { getTablePageConfig } from "@/lib/page-data";
import { prisma } from "@/lib/prisma";
import { getSingleSearchParam } from "@/lib/query-params";
import { hasPermission } from "@/lib/rbac";
function createDeleteItemHref(productId) {
    const params = new URLSearchParams({
        deleteProductId: productId,
        delete: "1",
    });
    return `/inventory/products?${params.toString()}`;
}
export default async function Page({ searchParams }) {
    const params = await searchParams;
    const initialDeleteOpen = getSingleSearchParam(params, "delete") === "1";
    const initialOpen = getSingleSearchParam(params, "open") === "1" && !initialDeleteOpen;
    const productId = getSingleSearchParam(params, "productId");
    const deleteProductId = getSingleSearchParam(params, "deleteProductId");
    const isEdit = getSingleSearchParam(params, "mode") === "edit" && Boolean(productId);
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
    const configWithDelete = canDelete
        ? {
            ...config,
            rows: config.rows.map((row) => ({
                ...row,
                __actions: [
                    ...(row.__actions ?? []),
                    {
                        key: "delete",
                        label: "Delete",
                        href: createDeleteItemHref(row.id),
                        icon: "trash",
                        variant: "destructive",
                    },
                ],
            })),
        }
        : config;
    if (!user || !hasPermission(user.role, "inventory:manage")) {
        return _jsx(TablePage, { config: configWithDelete });
    }
    return (_jsxs(_Fragment, { children: [_jsx(ModalTablePage, { config: configWithDelete, actionLabel: "New item", dialogTitle: product ? "Edit item" : "New item", dialogDescription: product ? "Update item details without leaving the list." : "Create an item record.", initialOpen: initialOpen, children: _jsx(ProductForm, { mode: "modal", intent: product ? "edit" : "create", ...(product
                        ? {
                            initialValues: {
                                id: product.id,
                                name: product.name,
                                minimumStockAlert: product.minimumStockAlert,
                                unit: product.unit,
                                description: product.description ?? "",
                            },
                        }
                        : {}) }) }), _jsx(ProductDeleteDialog, { product: deleteProduct, open: initialDeleteOpen && canDelete })] }));
}
