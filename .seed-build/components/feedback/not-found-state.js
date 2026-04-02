import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Link from "next/link";
import { LayoutDashboard, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from "@/components/ui/card";
import { cn } from "@/lib/utils";
export function NotFoundState({ fullScreen = false, className, }) {
    return (_jsx("div", { className: cn("flex items-center justify-center px-4 py-10 sm:px-6", fullScreen ? "min-h-screen" : "min-h-[65vh]", className), children: _jsxs(Card, { className: "max-w-xl bg-card/95", children: [_jsxs(CardHeader, { className: "space-y-5", children: [_jsx("div", { className: "flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-primary/10 text-primary shadow-sm", children: _jsx(SearchX, { className: "h-7 w-7" }) }), _jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground", children: "404 Error" }), _jsx(CardTitle, { className: "text-3xl", children: "Page not found" }), _jsx(CardDescription, { className: "text-base leading-7", children: "The page you requested is not available. Return to the dashboard to keep working from the main screen." })] })] }), _jsx(CardContent, { className: "flex flex-wrap gap-3", children: _jsx(Button, { asChild: true, children: _jsxs(Link, { href: "/dashboard", children: [_jsx(LayoutDashboard, { className: "h-4 w-4" }), "Back to dashboard"] }) }) })] }) }));
}
