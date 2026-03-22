export const APP_ROLES = ["ADMIN", "SALES"] as const;
export const APP_PERMISSIONS = [
  "dashboard:view",
  "daily-check:view",
  "inventory:view",
  "inventory:manage",
  "sales:create",
  "sales:view",
  "customer-payments:create",
  "purchases:create",
  "purchases:view",
  "customers:manage",
  "suppliers:manage",
  "sellers:manage",
  "seller-settlements:create",
  "expenses:view",
  "expenses:create",
  "accounts:use",
  "accounts:manage",
  "ledger:view",
  "cash-transfers:manage",
  "reports:view",
  "admin:manage",
  "audit:view",
] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type AppPermission = (typeof APP_PERMISSIONS)[number];

export const permissionsByRole: Record<AppRole, readonly AppPermission[]> = {
  ADMIN: [
    "dashboard:view",
    "daily-check:view",
    "inventory:view",
    "inventory:manage",
    "sales:create",
    "sales:view",
    "customer-payments:create",
    "purchases:create",
    "purchases:view",
    "customers:manage",
    "suppliers:manage",
    "sellers:manage",
    "seller-settlements:create",
    "expenses:view",
    "expenses:create",
    "accounts:use",
    "accounts:manage",
    "ledger:view",
    "cash-transfers:manage",
    "reports:view",
    "admin:manage",
    "audit:view",
  ],
  SALES: [
    "dashboard:view",
    "daily-check:view",
    "inventory:view",
    "inventory:manage",
    "sales:create",
    "sales:view",
    "customer-payments:create",
    "purchases:create",
    "purchases:view",
    "customers:manage",
    "suppliers:manage",
    "sellers:manage",
    "seller-settlements:create",
    "expenses:view",
    "expenses:create",
    "accounts:use",
  ],
};

const pathPermissionRules: ReadonlyArray<{
  prefix: string;
  permission: AppPermission;
}> = [
  { prefix: "/admin", permission: "admin:manage" },
  { prefix: "/reports", permission: "reports:view" },
  { prefix: "/finance/expenses", permission: "expenses:view" },
  { prefix: "/finance/accounts", permission: "accounts:manage" },
  { prefix: "/finance/cash-transfers", permission: "cash-transfers:manage" },
  { prefix: "/finance/cash", permission: "cash-transfers:manage" },
  { prefix: "/finance/ledger", permission: "ledger:view" },
  { prefix: "/purchases/new", permission: "purchases:create" },
  { prefix: "/purchases/suppliers", permission: "suppliers:manage" },
  { prefix: "/purchases/supplier-payments", permission: "accounts:manage" },
  { prefix: "/purchases", permission: "purchases:view" },
  { prefix: "/sellers/collections", permission: "seller-settlements:create" },
  { prefix: "/sellers/settlements", permission: "seller-settlements:create" },
  { prefix: "/sellers", permission: "sellers:manage" },
  { prefix: "/sales/daily-check", permission: "daily-check:view" },
  { prefix: "/sales/new", permission: "sales:create" },
  { prefix: "/sales/customers", permission: "customers:manage" },
  { prefix: "/sales/customer-credit", permission: "customers:manage" },
  { prefix: "/sales/customer-payments", permission: "customer-payments:create" },
  { prefix: "/sales", permission: "sales:view" },
  { prefix: "/inventory/products", permission: "inventory:manage" },
  { prefix: "/inventory/transfers", permission: "inventory:manage" },
  { prefix: "/inventory/stock-overview", permission: "inventory:view" },
  { prefix: "/inventory/low-stock", permission: "inventory:view" },
  { prefix: "/inventory/out-of-stock", permission: "inventory:view" },
  { prefix: "/inventory/alert-records", permission: "inventory:view" },
  { prefix: "/inventory/stock-movements", permission: "inventory:view" },
  { prefix: "/inventory", permission: "inventory:view" },
  { prefix: "/dashboard", permission: "dashboard:view" },
  { prefix: "/profile", permission: "dashboard:view" },
];

export function hasPermission(role: AppRole, permission: AppPermission) {
  return permissionsByRole[role].includes(permission);
}

export function getRequiredPermissionForPath(pathname: string) {
  const match = pathPermissionRules.find(
    (rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`),
  );

  return match?.permission ?? null;
}

export function canAccessPath(role: AppRole, pathname: string) {
  const requiredPermission = getRequiredPermissionForPath(pathname);

  return !requiredPermission || hasPermission(role, requiredPermission);
}
