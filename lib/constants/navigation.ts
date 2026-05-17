import type { IconName } from "@/lib/icons";
import { hasPermission, type AppPermission, type AppRole } from "@/lib/rbac";

export type NavigationItem = {
  title: string;
  href: string;
  icon: IconName;
  roles?: AppRole[];
  permission?: AppPermission;
};

export type NavigationEntry =
  | ({
      type: "link";
    } & NavigationItem)
  | {
      type: "group";
      title: string;
      icon: IconName;
      roles?: AppRole[];
      permission?: AppPermission;
      items: NavigationItem[];
    };

export const navigationEntries: NavigationEntry[] = [
  {
    type: "link",
    title: "Dashboard",
    href: "/dashboard",
    icon: "dashboard",
    permission: "dashboard:view",
  },
  {
    type: "group",
    title: "Inventory",
    icon: "inventory",
    items: [
      {
        title: "Items",
        href: "/inventory/products",
        icon: "products",
        permission: "inventory:manage",
      },
      {
        title: "Current Stock",
        href: "/inventory/stock-overview",
        icon: "stockOverview",
        permission: "inventory:view",
      },
      {
        title: "Low Stock",
        href: "/inventory/low-stock",
        icon: "lowStock",
        permission: "inventory:view",
      },
      {
        title: "Out Of Stock",
        href: "/inventory/out-of-stock",
        icon: "lowStock",
        permission: "inventory:view",
      },
      {
        title: "Transfers",
        href: "/inventory/transfers",
        icon: "transfers",
        permission: "inventory:view",
      },
    ],
  },
  {
    type: "group",
    title: "Sales",
    icon: "sales",
    items: [
      {
        title: "New Sale",
        href: "/sales/new",
        icon: "newSale",
        permission: "sales:create",
      },
      {
        title: "Sales List",
        href: "/sales/sales-list",
        icon: "salesList",
        permission: "sales:view",
      },
      {
        title: "Daily Check",
        href: "/sales/daily-check",
        icon: "salesList",
        permission: "daily-check:view",
      },
      {
        title: "Sold Items",
        href: "/sales/sold-items",
        icon: "soldItems",
        permission: "sales:view",
      },
      {
        title: "Customers",
        href: "/sales/customers",
        icon: "customers",
        permission: "customers:manage",
      },
      {
        title: "Customer Credit",
        href: "/sales/customer-credit",
        icon: "customerCredit",
        permission: "customers:manage",
      },
    ],
  },
  {
    type: "group",
    title: "Purchases",
    icon: "purchases",
    items: [
      {
        title: "New Purchase",
        href: "/purchases/new",
        icon: "newPurchase",
        permission: "purchases:create",
      },
      {
        title: "Purchase List",
        href: "/purchases/list",
        icon: "purchaseList",
        permission: "purchases:view",
      },
      {
        title: "Suppliers",
        href: "/purchases/suppliers",
        icon: "suppliers",
        permission: "suppliers:manage",
      },
    ],
  },
  {
    type: "group",
    title: "Sellers",
    icon: "sellers",
    items: [
      {
        title: "Sellers",
        href: "/sellers/list",
        icon: "sellers",
        permission: "sellers:manage",
      },
      {
        title: "Received Stock",
        href: "/sellers/new-intake",
        icon: "newPurchase",
        permission: "sellers:manage",
      },
      {
        title: "Assign Items",
        href: "/sellers/assign-items",
        icon: "stockMovements",
        permission: "sellers:manage",
      },
      {
        title: "Assigned Items",
        href: "/sellers/assigned-items",
        icon: "soldItems",
        permission: "sellers:manage",
      },
      {
        title: "Returns",
        href: "/sellers/returns",
        icon: "transfers",
        permission: "sellers:manage",
      },
      {
        title: "Pay Sellers",
        href: "/sellers/settlements",
        icon: "supplierPayments",
        permission: "seller-settlements:create",
      },
      {
        title: "Collect From Sellers",
        href: "/sellers/collections",
        icon: "customerPayments",
        permission: "seller-settlements:create",
      },
    ],
  },
  {
    type: "link",
    title: "Expenses",
    href: "/finance/expenses",
    icon: "expenses",
    roles: ["SALES"],
    permission: "expenses:view",
  },
  {
    type: "group",
    title: "Finance",
    icon: "accounts",
    roles: ["ADMIN"],
    items: [
      {
        title: "Accounts",
        href: "/finance/accounts",
        icon: "accounts",
        permission: "accounts:manage",
      },
      {
        title: "Cash",
        href: "/finance/cash",
        icon: "cashTransfers",
        permission: "cash-transfers:manage",
      },
      {
        title: "Expenses",
        href: "/finance/expenses",
        icon: "expenses",
        permission: "expenses:view",
      },
      {
        title: "Ledger",
        href: "/finance/ledger",
        icon: "ledger",
        permission: "ledger:view",
      },
    ],
  },
  {
    type: "link",
    title: "Reports",
    href: "/reports",
    icon: "reports",
    permission: "reports:view",
  },
  {
    type: "group",
    title: "Administration",
    icon: "admin",
    roles: ["ADMIN"],
    items: [
      { title: "Branches", href: "/admin/branches", icon: "branches", roles: ["ADMIN"] },
      { title: "Users", href: "/admin/users", icon: "users", roles: ["ADMIN"] },
    ],
  },
];

const hiddenPageTitles: NavigationItem[] = [
  { title: "Profile", href: "/profile", icon: "users" },
  { title: "Alert Records", href: "/inventory/alert-records", icon: "alertRecords" },
  { title: "Stock Movements", href: "/inventory/stock-movements", icon: "stockMovements" },
  { title: "Customer Payments", href: "/sales/customer-payments", icon: "customerPayments" },
  { title: "Supplier Payments", href: "/purchases/supplier-payments", icon: "supplierPayments" },
  { title: "Seller Overview", href: "/sellers", icon: "sellers" },
  { title: "Received Records", href: "/sellers/intake-records", icon: "purchaseList" },
  { title: "Cash", href: "/finance/cash", icon: "cashTransfers" },
  { title: "Cash Transfers", href: "/finance/cash-transfers", icon: "cashTransfers" },
  { title: "Roles", href: "/admin/roles", icon: "roles", roles: ["ADMIN"] },
  { title: "Audit Logs", href: "/admin/audit-logs", icon: "auditLogs", roles: ["ADMIN"] },
  { title: "Settings", href: "/admin/settings", icon: "settings", roles: ["ADMIN"] },
  { title: "Inventory Reports", href: "/reports/inventory", icon: "reports" },
  { title: "Sales Reports", href: "/reports/sales", icon: "reports" },
  { title: "Purchase Reports", href: "/reports/purchases", icon: "reports" },
  { title: "Seller Reports", href: "/reports/sellers", icon: "reports" },
  { title: "Finance Reports", href: "/reports/finance", icon: "reports" },
];

const hiddenGroupPrefixes = [
  {
    groupTitle: "Sellers",
    href: "/sellers",
  },
] as const;

function itemAllowed(
  itemRoles: AppRole[] | undefined,
  permission: AppPermission | undefined,
  role: AppRole,
) {
  return (!itemRoles || itemRoles.includes(role)) && (!permission || hasPermission(role, permission));
}

export function getVisibleNavigation(role: AppRole) {
  return navigationEntries
    .filter((entry) => itemAllowed(entry.roles, entry.permission, role))
    .map((entry) => {
      if (entry.type === "link") {
        return entry;
      }

      return {
        ...entry,
        items: entry.items.filter((item) => itemAllowed(item.roles, item.permission, role)),
      };
    })
    .filter((entry) => (entry.type === "link" ? true : entry.items.length > 0));
}

export function getNavigationTitle(pathname: string) {
  const items = navigationEntries.flatMap((entry) =>
    entry.type === "link" ? [entry] : entry.items,
  );
  const candidates = [...items, ...hiddenPageTitles]
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((left, right) => right.href.length - left.href.length);

  return candidates[0]?.title ?? "Stock Management";
}

export function getOpenGroupForPath(pathname: string, role: AppRole) {
  const visibleEntries = getVisibleNavigation(role);
  const match = visibleEntries.find((entry) => {
    return (
      entry.type === "group" &&
      entry.items.some(
        (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
      )
    );
  });

  if (match?.type === "group") {
    return match.title;
  }

  const hiddenMatch = hiddenGroupPrefixes.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return hiddenMatch?.groupTitle ?? null;
}
