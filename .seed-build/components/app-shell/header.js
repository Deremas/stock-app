"use client";
import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Building2, ChevronDown, LogOut, Menu, UserRound } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/app-shell/theme-toggle";
import { Select } from "@/components/ui/select";
import { setActiveBranchAction } from "@/lib/actions/branches";
import { getNavigationTitle } from "@/lib/constants/navigation";
import { authClient } from "@/lib/auth/client";
export function AppHeader({ user, onMenuToggle, }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isSignOutPending, startSignOutTransition] = useTransition();
    const [isBranchPending, startBranchTransition] = useTransition();
    const [selectedBranchId, setSelectedBranchId] = useState(user.activeBranchId);
    const pageTitle = getNavigationTitle(pathname);
    const activeBranch = user.branches.find((branch) => branch.id === user.activeBranchId) ?? user.branches[0];
    const activeBranchLabel = activeBranch
        ? activeBranch.code
            ? `${activeBranch.code} - ${activeBranch.name}`
            : activeBranch.name
        : "";
    const topbarControlClass = "border-[hsl(var(--topbar-border)/0.9)] bg-[hsl(var(--topbar-surface-strong)/0.94)] text-[hsl(var(--topbar-foreground))] shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:border-[hsl(var(--topbar-accent)/0.34)] hover:bg-[hsl(var(--topbar-surface-strong))] dark:shadow-[0_16px_32px_rgba(2,8,23,0.34)]";
    const topbarMutedTextClass = "text-[hsl(var(--topbar-muted))]";
    useEffect(() => {
        setSelectedBranchId(user.activeBranchId);
    }, [user.activeBranchId]);
    const branchControl = activeBranch ? (_jsx("div", { className: "min-w-0 max-w-[8.75rem] sm:max-w-[20rem]", children: _jsx(Select, { "aria-label": "Switch active branch", className: `h-10 w-full min-w-0 rounded-full px-3 text-sm font-medium sm:h-auto sm:rounded-2xl sm:py-2 ${topbarControlClass} [&_svg]:text-[hsl(var(--topbar-muted))]`, disabled: isBranchPending || user.branches.length <= 1, triggerLabel: _jsxs(_Fragment, { children: [_jsx("span", { className: "block truncate text-sm font-medium sm:hidden", children: activeBranch.name }), _jsxs("span", { className: "hidden min-w-0 items-center gap-2 sm:flex", children: [_jsx(Building2, { className: "h-4 w-4 shrink-0 text-[hsl(var(--topbar-accent))]" }), _jsxs("span", { className: "min-w-0", children: [_jsx("span", { className: `block text-[10px] font-semibold uppercase tracking-[0.18em] ${topbarMutedTextClass}`, children: "Active Branch" }), _jsx("span", { className: "block truncate text-sm font-medium text-[hsl(var(--topbar-foreground))]", children: activeBranchLabel })] })] })] }), value: selectedBranchId, onChange: (event) => {
                const nextBranchId = event.target.value;
                if (!nextBranchId || nextBranchId === user.activeBranchId) {
                    setSelectedBranchId(user.activeBranchId);
                    return;
                }
                setSelectedBranchId(nextBranchId);
                startBranchTransition(async () => {
                    const result = await setActiveBranchAction({
                        branchId: nextBranchId,
                    });
                    if (!result.success) {
                        setSelectedBranchId(user.activeBranchId);
                        toast.error(result.message);
                        return;
                    }
                    toast.success(result.message);
                    router.refresh();
                });
            }, children: user.branches.map((branch) => (_jsxs("option", { value: branch.id, children: [branch.code, " - ", branch.name] }, branch.id))) }) })) : user.role === "ADMIN" ? (pathname === "/admin/branches" ? null : (_jsx(Button, { asChild: true, size: "sm", variant: "outline", className: `h-10 rounded-full px-3 ${topbarControlClass}`, children: _jsx(Link, { href: "/admin/branches", prefetch: false, children: "Create first branch" }) }))) : (_jsx("div", { className: `rounded-full border border-dashed px-3 py-2 text-sm ${topbarControlClass} ${topbarMutedTextClass}`, children: "No branch created yet" }));
    function handleSignOut() {
        startSignOutTransition(async () => {
            try {
                await authClient.signOut();
                router.push("/login");
                router.refresh();
            }
            catch {
                toast.error("Unable to sign out right now.");
            }
        });
    }
    return (_jsx("header", { className: "sticky top-0 z-30 max-w-full shrink-0 overflow-x-clip border-b border-[hsl(var(--topbar-border)/0.86)] bg-[linear-gradient(135deg,hsl(var(--topbar-surface)/0.96),hsl(var(--topbar-surface-strong)/0.92))] px-4 py-3 text-[hsl(var(--topbar-foreground))] shadow-[0_14px_32px_rgba(14,116,144,0.12)] backdrop-blur supports-[backdrop-filter]:bg-[linear-gradient(135deg,hsl(var(--topbar-surface)/0.9),hsl(var(--topbar-surface-strong)/0.84))] dark:shadow-[0_20px_40px_rgba(2,8,23,0.4)]", children: _jsx("div", { className: "mx-auto w-full min-w-0 max-w-[1360px]", children: _jsxs("div", { className: "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3", children: [_jsx("div", { className: "flex min-w-0 items-center gap-2", children: _jsx(Button, { type: "button", variant: "outline", size: "icon", className: `h-10 w-10 rounded-2xl ${topbarControlClass}`, onClick: onMenuToggle, "aria-label": "Toggle sidebar", children: _jsx(Menu, { className: "h-4 w-4" }) }) }), _jsx("div", { className: "min-w-0 text-center", children: _jsx("h1", { className: "truncate text-sm font-semibold tracking-tight text-[hsl(var(--topbar-foreground))] sm:text-lg", children: pageTitle }) }), _jsxs("div", { className: "flex min-w-0 items-center justify-end gap-1.5 sm:gap-2", children: [branchControl, _jsx(ThemeToggle, {}), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs("button", { type: "button", className: `flex max-w-full items-center gap-3 rounded-full px-3 py-2 ${topbarControlClass}`, children: [_jsx(Avatar, { name: user.name }), _jsxs("div", { className: "hidden text-left sm:block", children: [_jsx("p", { className: "max-w-[8rem] truncate text-sm font-medium text-[hsl(var(--topbar-foreground))]", children: user.name }), _jsx("p", { className: `text-xs ${topbarMutedTextClass}`, children: user.role })] }), _jsx(ChevronDown, { className: `h-4 w-4 ${topbarMutedTextClass}` })] }) }), _jsxs(DropdownMenuContent, { align: "end", className: "w-56", children: [_jsx(DropdownMenuLabel, { children: _jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-sm font-medium", children: user.name }), _jsx("p", { className: "text-xs font-normal text-muted-foreground", children: user.username })] }) }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onSelect: () => router.push("/profile"), children: [_jsx(UserRound, { className: "mr-2 h-4 w-4" }), "Profile"] }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { disabled: isSignOutPending, onSelect: handleSignOut, children: [_jsx(LogOut, { className: "mr-2 h-4 w-4" }), isSignOutPending ? "Signing out..." : "Sign out"] })] })] })] })] }) }) }));
}
