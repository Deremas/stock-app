import Link from "next/link";
import type { Route } from "next";
import {
  ArrowRight,
  HandCoins,
  ReceiptText,
  ShoppingCart,
  Truck,
  UsersRound,
  Wallet,
  WalletCards,
  Boxes,
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
    title: "Give Item To Partner",
    description: "Assign owned items to a partner and set the partner price.",
    href: "/sellers/assign-items?open=1",
    permission: "sellers:manage",
    icon: Boxes,
  },
  {
    title: "Collect From Partner",
    description: "Post cash or bank collection for sold assigned items.",
    href: "/sellers/collections?open=1" as Route,
    permission: "seller-settlements:create",
    icon: Wallet,
  },
  {
    title: "Customers",
    description: "Review customers, credit balances, and follow-up accounts.",
    href: "/sales/customers",
    permission: "customers:manage",
    icon: UsersRound,
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
    permission: "expenses:create",
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
      <CardContent className="grid grid-cols-2 gap-3 max-[359px]:grid-cols-1">
        {visibleActions.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-2xl border border-border/70 bg-background/80 p-3 transition hover:border-primary/30 hover:bg-accent/40 sm:p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold sm:text-sm">{action.title}</p>
                  <p className="text-[11px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">
                    {action.description}
                  </p>
                </div>
                <span className="rounded-xl border border-border/70 bg-card p-1.5 text-primary sm:p-2">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs font-medium text-primary sm:mt-3 sm:text-sm">
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
