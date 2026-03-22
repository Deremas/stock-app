import Link from "next/link";
import type { Route } from "next";
import {
  ArrowRight,
  HandCoins,
  ReceiptText,
  ShoppingCart,
  Truck,
  WalletCards,
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
    title: "New Purchase",
    description: "Add supplier stock and update buying prices.",
    href: "/purchases/new",
    permission: "purchases:create",
    icon: Truck,
  },
  {
    title: "Receive Partner Stock",
    description: "Record items brought by partners for selling.",
    href: "/sellers/new-intake",
    permission: "sellers:manage",
    icon: HandCoins,
  },
  {
    title: "Cash To Bank",
    description: "Deposit cash into the bank account you choose.",
    href: "/finance/cash",
    permission: "accounts:manage",
    icon: WalletCards,
  },
  {
    title: "Record Expense",
    description: "Post rent, transport, salary, or daily running costs.",
    href: "/finance/expenses",
    permission: "expenses:manage",
    icon: ReceiptText,
  },
];

export function QuickActionsCard({ role }: { role: AppRole }) {
  const visibleActions = quickActions.filter((action) => hasPermission(role, action.permission));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Use the few daily shortcuts that matter most.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {visibleActions.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-2xl border border-border/70 bg-background/80 p-4 transition hover:border-primary/30 hover:bg-accent/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{action.title}</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {action.description}
                  </p>
                </div>
                <span className="rounded-xl border border-border/70 bg-card p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 flex items-center gap-1 text-sm font-medium text-primary">
                Open
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
