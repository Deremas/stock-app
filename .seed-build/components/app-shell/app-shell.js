"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-shell/header";
import { AppSidebar } from "@/components/app-shell/sidebar";
import { BuiltByFooter } from "@/components/shared/built-by-footer";
import { cn } from "@/lib/utils";
export function AppShell({ user, children, }) {
    const pathname = usePathname();
    const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    useEffect(() => {
        setMobileSidebarOpen(false);
    }, [pathname]);
    function handleSidebarToggle() {
        if (window.matchMedia("(min-width: 1024px)").matches) {
            setDesktopSidebarOpen((current) => !current);
            return;
        }
        setMobileSidebarOpen((current) => !current);
    }
    return (_jsxs("div", { className: "h-screen w-full max-w-full bg-background", children: [_jsx(AppSidebar, { role: user.role, desktopOpen: desktopSidebarOpen, mobileOpen: mobileSidebarOpen, onNavigate: () => setMobileSidebarOpen(false), onCloseMobile: () => setMobileSidebarOpen(false) }), _jsxs("div", { className: cn("flex h-screen min-w-0 max-w-full flex-1 flex-col overflow-y-auto transition-[margin] duration-200", desktopSidebarOpen ? "lg:ml-72" : "lg:ml-0"), children: [_jsx(AppHeader, { user: user, onMenuToggle: handleSidebarToggle }), _jsx("main", { className: "flex-1 min-w-0 max-w-full px-4 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6 lg:px-8 lg:pb-8 lg:pt-6", children: _jsx("div", { className: "mx-auto flex w-full min-w-0 max-w-[1360px] flex-col gap-5", children: children }) }), _jsx("div", { className: "border-t border-border/60 px-4 py-4 sm:px-6 lg:px-8", children: _jsx(BuiltByFooter, { className: "mx-auto max-w-[1360px] justify-center" }) })] })] }));
}
