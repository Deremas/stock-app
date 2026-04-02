import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Link from "next/link";
import { Github } from "lucide-react";
import { cn } from "@/lib/utils";
export function BuiltByFooter({ tone = "default", className, }) {
    const textClassName = tone === "inverse" ? "text-white/78" : "text-muted-foreground";
    const linkClassName = tone === "inverse"
        ? "text-white hover:text-white"
        : "text-foreground hover:text-primary";
    return (_jsxs("footer", { className: cn("flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm", textClassName, className), children: [_jsx("span", { children: "Built by" }), _jsxs(Link, { href: "https://github.com/Deremas", target: "_blank", rel: "noreferrer", className: cn("inline-flex items-center gap-1.5 font-medium transition-colors", linkClassName), children: [_jsx(Github, { className: "h-4 w-4" }), "Dereje M."] })] }));
}
