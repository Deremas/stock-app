"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import Link from "next/link";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getOpenGroupForPath, getVisibleNavigation, } from "@/lib/constants/navigation";
import { getIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
export function AppSidebar({ role, desktopOpen, mobileOpen, onNavigate, onCloseMobile, }) {
    const pathname = usePathname();
    const entries = useMemo(() => getVisibleNavigation(role), [role]);
    const [openGroup, setOpenGroup] = useState(getOpenGroupForPath(pathname, role));
    useEffect(() => {
        const activeGroup = getOpenGroupForPath(pathname, role);
        if (activeGroup) {
            setOpenGroup(activeGroup);
        }
    }, [pathname, role]);
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: cn("fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-[1px] transition-opacity lg:hidden", mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"), onClick: onCloseMobile }), _jsxs("aside", { className: cn("fixed inset-y-0 left-0 z-[60] flex w-72 max-w-[calc(100vw-1rem)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-200 lg:z-40 lg:shadow-none", desktopOpen ? "lg:translate-x-0" : "lg:-translate-x-full", mobileOpen ? "translate-x-0" : "-translate-x-full"), children: [_jsxs("div", { className: "flex items-center justify-between border-b border-sidebar-border px-4 py-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold tracking-tight", children: "Stock Management App" }), _jsx("p", { className: "text-xs text-sidebar-foreground/65", children: "Simple daily operations" })] }), _jsx("button", { type: "button", className: "rounded-lg p-2 text-sidebar-foreground/70 transition hover:bg-accent/80 hover:text-sidebar-foreground lg:hidden", onClick: onCloseMobile, "aria-label": "Close sidebar", children: _jsx(X, { className: "h-6 w-6" }) })] }), _jsx("nav", { className: "flex-1 overflow-y-auto px-3 py-4", children: _jsx("div", { className: "space-y-2", children: entries.map((entry) => {
                                const Icon = getIcon(entry.icon);
                                if (entry.type === "link") {
                                    const active = pathname === entry.href || pathname.startsWith(`${entry.href}/`);
                                    return (_jsx("div", { className: cn("overflow-hidden rounded-2xl border border-sidebar-border bg-card/65 transition-all duration-200", active
                                            ? "border-sidebar-accent/25 bg-sidebar-accent/[0.08] shadow-[0_12px_30px_rgba(14,116,144,0.08)]"
                                            : "bg-card/65"), children: _jsxs(Link, { href: entry.href, prefetch: false, className: cn("flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200", active
                                                ? "bg-sidebar-accent text-white shadow-sm"
                                                : "text-sidebar-foreground/80 hover:bg-accent/80 hover:text-sidebar-foreground"), onClick: onNavigate, children: [_jsx(Icon, { className: "h-4 w-4 shrink-0" }), _jsx("span", { className: "truncate", children: entry.title })] }) }, entry.href));
                                }
                                const groupActive = entry.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
                                const expanded = openGroup === entry.title;
                                return (_jsxs("div", { className: cn("overflow-hidden rounded-2xl border border-sidebar-border bg-card/65 transition-all duration-200", groupActive &&
                                        "border-sidebar-accent/25 bg-sidebar-accent/[0.08] shadow-[0_12px_30px_rgba(14,116,144,0.08)]", !groupActive &&
                                        expanded &&
                                        "border-border/80 bg-card/90 shadow-[inset_0_0_0_1px_rgba(14,116,144,0.05)]"), children: [_jsxs("button", { type: "button", className: cn("flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200", groupActive
                                                ? "bg-sidebar-accent/[0.10] text-sidebar-foreground shadow-[inset_0_0_0_1px_rgba(14,116,144,0.08)]"
                                                : expanded
                                                    ? "bg-card/85 text-sidebar-foreground"
                                                    : "text-sidebar-foreground/80 hover:bg-accent/80 hover:text-sidebar-foreground"), onClick: () => setOpenGroup((current) => current === entry.title ? null : entry.title), children: [_jsx("span", { "aria-hidden": "true", className: cn("h-8 w-1 shrink-0 rounded-full transition-all duration-200", groupActive
                                                        ? "bg-sidebar-accent shadow-[0_0_0_3px_rgba(14,116,144,0.10)]"
                                                        : expanded
                                                            ? "bg-sidebar-accent/35"
                                                            : "bg-transparent") }), _jsx(Icon, { className: cn("h-4 w-4 shrink-0 transition-colors", groupActive ? "text-sidebar-accent" : "text-current") }), _jsx("span", { className: "flex-1", children: entry.title }), _jsx(ChevronDown, { className: cn("h-4 w-4 shrink-0 transition-all duration-200", groupActive && "text-sidebar-accent", expanded && "rotate-180") })] }), expanded ? (_jsx("div", { className: cn("space-y-1 px-2 pb-2 pt-1", groupActive && "border-t border-sidebar-accent/10 bg-background/40"), children: entry.items.map((item) => {
                                                const ItemIcon = getIcon(item.icon);
                                                const active = pathname === item.href ||
                                                    pathname.startsWith(`${item.href}/`);
                                                return (_jsxs(Link, { href: item.href, prefetch: false, className: cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200", active
                                                        ? "bg-sidebar-accent text-white shadow-sm ring-1 ring-sidebar-accent/30"
                                                        : "text-sidebar-foreground/75 hover:bg-accent/80 hover:text-sidebar-foreground"), onClick: onNavigate, children: [_jsx(ItemIcon, { className: "h-4 w-4 shrink-0" }), _jsx("span", { className: "truncate", children: item.title })] }, item.href));
                                            }) })) : null] }, entry.title));
                            }) }) })] })] }));
}
