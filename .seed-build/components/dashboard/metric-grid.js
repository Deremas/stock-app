import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
const toneIconMap = {
    default: Wallet,
    success: ArrowDownToLine,
    warning: AlertTriangle,
    danger: ArrowUpFromLine,
};
export function MetricGrid({ metrics, mobileColumns = 1, }) {
    const compactMobile = mobileColumns === 2;
    return (_jsx("div", { className: cn("grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3", compactMobile && "grid-cols-2 max-[359px]:grid-cols-1"), children: metrics.map((metric) => {
            const Icon = toneIconMap[metric.tone ?? "default"];
            return (_jsx(Card, { children: _jsx(CardContent, { className: cn("p-5", compactMobile && "p-4 sm:p-5"), children: _jsxs("div", { className: "flex min-w-0 items-start justify-between gap-3 sm:gap-4", children: [_jsxs("div", { className: "min-w-0 space-y-1.5 sm:space-y-2", children: [_jsx("p", { className: cn("text-sm text-muted-foreground", compactMobile && "text-xs leading-4 sm:text-sm"), children: metric.title }), _jsx("p", { className: cn("break-words text-xl font-semibold tracking-tight sm:text-2xl", compactMobile && "text-lg sm:text-2xl"), children: metric.value }), metric.meta ? (_jsx("p", { className: cn("text-xs text-muted-foreground", compactMobile && "text-[11px] leading-4 sm:text-xs"), children: metric.meta })) : null] }), _jsx(Badge, { variant: "outline", className: cn("shrink-0 rounded-xl px-2 py-2", compactMobile && "px-1.5 py-1.5 sm:px-2 sm:py-2"), children: _jsx(Icon, { className: "h-4 w-4" }) })] }) }) }, metric.title));
        }) }));
}
