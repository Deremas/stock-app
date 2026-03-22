import type { RowActionConfig, SimpleRow } from "@/lib/table";

import { UserForm } from "@/components/forms/user-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getUserFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { prisma } from "@/lib/prisma";
import { getSingleSearchParam, type RouteSearchParams } from "@/lib/query-params";

type UsersPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

function createEditUserHref(userId: string) {
  const params = new URLSearchParams({
    userId,
    mode: "edit",
    open: "1",
  });

  return `/admin/users?${params.toString()}`;
}

export default async function Page({ searchParams }: UsersPageProps) {
  const params = await searchParams;
  const initialOpen = getSingleSearchParam(params, "open") === "1";
  const userId = getSingleSearchParam(params, "userId");
  const isEdit = getSingleSearchParam(params, "mode") === "edit" && Boolean(userId);

  const config = await getTablePageConfig("adminUsers");
  const [options, selectedUser] = await Promise.all([
    getUserFormOptions(),
    isEdit && userId
      ? prisma.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            phone: true,
            role: true,
            defaultBranchId: true,
            branchAssignments: {
              where: {
                isActive: true,
              },
              select: {
                branchId: true,
              },
            },
          },
        })
      : null,
  ]);

  const configWithActions = {
    ...config,
    rows: config.rows.map(
      (row) =>
        ({
          ...row,
          __actions: [
            ...((row.__actions ?? []) as RowActionConfig[]),
            {
              key: "edit",
              label: "Edit",
              href: createEditUserHref(row.id),
              icon: "settings",
            },
          ],
        }) satisfies SimpleRow,
    ),
  };

  return (
    <ModalTablePage
      config={configWithActions}
      actionLabel="New user"
      dialogTitle={selectedUser ? "Edit user" : "New user"}
      dialogDescription={
        selectedUser
          ? "Update user details, assigned branches, and default branch."
          : "Create a user account with role, assigned branches, and login credentials."
      }
      initialOpen={initialOpen}
    >
      <UserForm
        options={options}
        intent={selectedUser ? "edit" : "create"}
        {...(selectedUser
          ? {
              initialValues: {
                id: selectedUser.id,
                name: selectedUser.name,
                email: selectedUser.email ?? "",
                username: selectedUser.username,
                phone: selectedUser.phone ?? "",
                password: "",
                role: selectedUser.role,
                branchIds: selectedUser.branchAssignments.map(
                  (assignment) => assignment.branchId,
                ),
                defaultBranchId: selectedUser.defaultBranchId ?? "",
              },
            }
          : {})}
      />
    </ModalTablePage>
  );
}
