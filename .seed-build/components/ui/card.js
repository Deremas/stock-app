import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "@/lib/utils";
export function Card({ className, ...props }) {
    return (_jsx("div", { className: cn("w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-border/70 bg-card/95 text-card-foreground shadow-panel backdrop-blur", className), ...props }));
}
export function CardHeader({ className, ...props }) {
    return _jsx("div", { className: cn("min-w-0 space-y-1.5 p-6", className), ...props });
}
export function CardTitle({ className, ...props }) {
    return (_jsx("h3", { className: cn("text-lg font-semibold tracking-tight", className), ...props }));
}
export function CardDescription({ className, ...props }) {
    return (_jsx("p", { className: cn("max-w-full break-words text-sm text-muted-foreground", className), ...props }));
}
export function CardContent({ className, ...props }) {
    return _jsx("div", { className: cn("min-w-0 p-6 pt-0", className), ...props });
}
export function CardFooter({ className, ...props }) {
    return (_jsx("div", { className: cn("flex items-center p-6 pt-0", className), ...props }));
}
