import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Link from "next/link";
import { ArrowRight, HandCoins, ReceiptText, ShoppingCart, Truck, UsersRound, Wallet, WalletCards, Boxes, } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPermission } from "@/lib/rbac";
const quickActions = [
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
        href: "/sellers/collections?open=1",
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
export function QuickActionsCard({ role }) {
    const visibleActions = quickActions.filter((action) => hasPermission(role, action.permission));
    return (_jsxs(Card, { className: "h-full", children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Quick Actions" }), _jsx(CardDescription, { children: "Use the few daily shortcuts that matter most." })] }), _jsx(CardContent, { className: "grid grid-cols-2 gap-3 max-[359px]:grid-cols-1", children: visibleActions.map((action) => {
                    const Icon = action.icon;
                    return (_jsxs(Link, { href: action.href, className: "group rounded-2xl border border-border/70 bg-background/80 p-3 transition hover:border-primary/30 hover:bg-accent/40 sm:p-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-xs font-semibold sm:text-sm", children: action.title }), _jsx("p", { className: "text-[11px] leading-4 text-muted-foreground sm:text-xs sm:leading-5", children: action.description })] }), _jsx("span", { className: "rounded-xl border border-border/70 bg-card p-1.5 text-primary sm:p-2", children: _jsx(Icon, { className: "h-4 w-4" }) })] }), _jsxs("div", { className: "mt-2 flex items-center gap-1 text-xs font-medium text-primary sm:mt-3 sm:text-sm", children: ["Open", _jsx(ArrowRight, { className: "h-4 w-4 transition group-hover:translate-x-0.5" })] })] }, action.href));
                }) })] }));
}
