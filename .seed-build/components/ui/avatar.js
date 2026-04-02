import { jsx as _jsx } from "react/jsx-runtime";
import { getInitials } from "@/lib/utils";
export function Avatar({ name }) {
    return (_jsx("div", { className: "flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary", children: getInitials(name) }));
}
