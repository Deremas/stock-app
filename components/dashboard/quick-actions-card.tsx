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
    title: "Receive Seller Stock",
    description: "Record items brought by sellers for selling.",
    href: "/sellers/new-intake",
    permission: "sellers:manage",
    icon: HandCoins,
  },
  {
    title: "Seller Assignment",
    description: "Assign owned items to a seller and set the seller price.",
    href: "/sellers/assign-items?open=1",
    permission: "sellers:manage",
    icon: Boxes,
  },
  {
    title: "Record Return",
    description: "Return unsold items to seller or back to branch stock.",
    href: "/sellers/returns?open=1" as Route,
    permission: "sellers:manage",
    icon: ArrowRight,
  },
  {
    title: "Collect From Seller",
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
  
  const salesActions = visibleActions.filter(a => a.href.startsWith("/sales"));
  const sellerActions = visibleActions.filter(a => a.href.startsWith("/sellers"));
  const financeActions = visibleActions.filter(a => a.href.startsWith("/finance"));

  const groups = [
    { name: "Daily Sales", actions: salesActions },
    { name: "Seller Operations", actions: sellerActions },
    { name: "Shop Finance", actions: financeActions },
  ].filter(g => g.actions.length > 0);

  return (
    <Card className="h-full border-none bg-transparent shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl">Daily Command Center</CardTitle>
        <CardDescription>Quick access to your essential shop workflows.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 px-0">
        {groups.map((group) => (
          <div key={group.name} className="space-y-4">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/80">
              {group.name}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {group.actions.map((action) => {
                const Icon = action.icon;

                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/50 bg-card/50 p-4 transition-all hover:border-primary/30 hover:bg-card hover:shadow-xl hover:shadow-primary/5 dark:bg-card/20 dark:hover:bg-card/30"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5">
                        <p className="text-sm font-semibold tracking-tight sm:text-base">{action.title}</p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2 sm:text-xs">
                          {action.description}
                        </p>
                      </div>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <Icon className="h-5 w-5" />
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-primary opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100 sm:text-[11px]">
                      START NOW
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
