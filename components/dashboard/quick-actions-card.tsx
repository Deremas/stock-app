import Link from "next/link";
import type { Route } from "next";
import {
  ArrowRight,
  Landmark,
  ReceiptText,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppPermission, AppRole } from "@/lib/rbac";
import { hasPermission } from "@/lib/rbac";

type QuickAction = {
  title: string;
  description: string;
  href: Route;
  permission: AppPermission;
  icon: typeof ShoppingCart;
};

const quickActions: QuickAction[] = [
  {
    title: "New Sale",
    description: "Start selling and post today's customer payment.",
    href: "/sales/new",
    permission: "sales:create",
    icon: ShoppingCart,
  },
  {
    title: "Receive Purchase",
    description: "Add received items and their buying prices.",
    href: "/purchases/new",
    permission: "purchases:create",
    icon: Truck,
  },
  {
    title: "Adjust Stock",
    description: "Update quantity, purchase price, or selling price.",
    href: "/inventory/stock",
    permission: "inventory:manage",
    icon: SlidersHorizontal,
  },
  {
    title: "Record Expense",
    description: "Post rent, transport, salary, or daily running costs.",
    href: "/finance/expenses",
    permission: "expenses:create",
    icon: ReceiptText,
  },
  {
    title: "Cash to Bank",
    description: "Deposit shop cash into a bank account.",
    href: "/finance/cash?open=1",
    permission: "cash-transfers:manage",
    icon: Landmark,
  },
];

export function QuickActionsCard({ role }: { role: AppRole }) {
  const visibleActions = quickActions.filter((action) => hasPermission(role, action.permission));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Quick Actions</CardTitle>
        <CardDescription>Start the tasks used most often.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {visibleActions.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.href}
              href={action.href}
              className="group flex min-w-0 items-start gap-3 rounded-2xl border border-border/70 bg-background/70 p-3 transition hover:border-primary/35 hover:bg-accent/45 sm:p-4"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-sm font-semibold">
                  {action.title}
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-55 transition group-hover:translate-x-0.5" />
                </span>
                <span className="mt-1 hidden text-xs leading-5 text-muted-foreground sm:block">
                  {action.description}
                </span>
              </span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
