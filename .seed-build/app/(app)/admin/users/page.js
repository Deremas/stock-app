import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { UserDeleteDialog } from "@/components/admin/user-delete-dialog";
import { UserStatusDialog } from "@/components/admin/user-status-dialog";
import { UserForm } from "@/components/forms/user-form";
import { ModalTablePage } from "@/components/tables/modal-table-page";
import { getUserFormOptions } from "@/lib/form-options";
import { getTablePageConfig } from "@/lib/page-data";
import { prisma } from "@/lib/prisma";
import { getSingleSearchParam } from "@/lib/query-params";
import { getUserDisplayUsername } from "@/lib/user-login";
import { isArchivedUsername } from "@/lib/user-archive";
function createEditUserHref(userId) {
    const params = new URLSearchParams({
        userId,
        mode: "edit",
        open: "1",
    });
    return `/admin/users?${params.toString()}`;
}
function createStatusUserHref(userId, nextState) {
    const params = new URLSearchParams({
        statusUserId: userId,
        status: nextState,
    });
    return `/admin/users?${params.toString()}`;
}
function createDeleteUserHref(userId) {
    const params = new URLSearchParams({
        deleteUserId: userId,
        delete: "1",
    });
    return `/admin/users?${params.toString()}`;
}
function normalizeManagedUser(user) {
    if (!user || isArchivedUsername(user.username)) {
        return null;
    }
    return user;
}
export default async function Page({ searchParams }) {
    const params = await searchParams;
    const statusIntent = getSingleSearchParam(params, "status");
    const statusUserId = getSingleSearchParam(params, "statusUserId");
    const deleteUserId = getSingleSearchParam(params, "deleteUserId");
    const initialStatusOpen = Boolean(statusUserId) && (statusIntent === "active" || statusIntent === "inactive");
    const initialDeleteOpen = getSingleSearchParam(params, "delete") === "1";
    const initialOpen = getSingleSearchParam(params, "open") === "1";
    const userId = getSingleSearchParam(params, "userId");
    const isEdit = getSingleSearchParam(params, "mode") === "edit" && Boolean(userId);
    const dialogOpen = initialOpen && !initialStatusOpen && !initialDeleteOpen;
    const config = await getTablePageConfig("adminUsers");
    const [options, selectedUser, statusUser, deleteUser] = await Promise.all([
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
                    displayUsername: true,
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
        initialStatusOpen && statusUserId
            ? prisma.user.findUnique({
                where: {
                    id: statusUserId,
                },
                select: {
                    id: true,
                    name: true,
                    displayName: true,
                    username: true,
                    isActive: true,
                },
            })
            : null,
        initialDeleteOpen && deleteUserId
            ? prisma.user.findUnique({
                where: {
                    id: deleteUserId,
                },
                select: {
                    id: true,
                    name: true,
                    displayName: true,
                    username: true,
                },
            })
            : null,
    ]);
    const resolvedSelectedUser = normalizeManagedUser(selectedUser);
    const resolvedStatusUser = normalizeManagedUser(statusUser);
    const resolvedDeleteUser = normalizeManagedUser(deleteUser);
    const configWithActions = {
        ...config,
        rows: config.rows.map((row) => ({
            ...row,
            __actions: [
                ...(row.__actions ?? []),
                {
                    key: "edit",
                    label: "Edit",
                    href: createEditUserHref(row.id),
                    icon: "settings",
                },
                {
                    key: row.status === "ACTIVE" ? "deactivate" : "activate",
                    label: row.status === "ACTIVE" ? "Deactivate" : "Activate",
                    href: createStatusUserHref(row.id, row.status === "ACTIVE" ? "inactive" : "active"),
                    icon: row.status === "ACTIVE" ? "userX" : "userCheck",
                    ...(row.status === "ACTIVE" ? { variant: "secondary" } : {}),
                },
                {
                    key: "delete",
                    label: "Delete",
                    href: createDeleteUserHref(row.id),
                    icon: "trash",
                    variant: "destructive",
                },
            ],
        })),
    };
    return (_jsxs(_Fragment, { children: [_jsx(ModalTablePage, { config: configWithActions, actionLabel: "New user", dialogTitle: resolvedSelectedUser ? "Edit user" : "New user", dialogDescription: resolvedSelectedUser
                    ? "Update user details, assigned branches, and default branch."
                    : "Create a user account with role, assigned branches, password, and at least one login ID.", initialOpen: dialogOpen, children: _jsx(UserForm, { options: options, intent: resolvedSelectedUser ? "edit" : "create", ...(resolvedSelectedUser
                        ? {
                            initialValues: {
                                id: resolvedSelectedUser.id,
                                name: resolvedSelectedUser.name,
                                email: resolvedSelectedUser.email ?? "",
                                username: getUserDisplayUsername(resolvedSelectedUser),
                                phone: resolvedSelectedUser.phone ?? "",
                                password: "",
                                role: resolvedSelectedUser.role,
                                branchIds: resolvedSelectedUser.branchAssignments.map((assignment) => assignment.branchId),
                                defaultBranchId: resolvedSelectedUser.defaultBranchId ?? "",
                            },
                        }
                        : {}) }) }), _jsx(UserStatusDialog, { user: resolvedStatusUser
                    ? {
                        id: resolvedStatusUser.id,
                        name: resolvedStatusUser.displayName ?? resolvedStatusUser.name,
                        isActive: resolvedStatusUser.isActive,
                    }
                    : null, open: initialStatusOpen }), _jsx(UserDeleteDialog, { user: resolvedDeleteUser
                    ? {
                        id: resolvedDeleteUser.id,
                        name: resolvedDeleteUser.displayName ?? resolvedDeleteUser.name,
                    }
                    : null, open: initialDeleteOpen })] }));
}
