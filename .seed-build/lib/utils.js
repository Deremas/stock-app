import { clsx } from "clsx";
import { format } from "date-fns";
import { twMerge } from "tailwind-merge";
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
export function formatCurrency(value) {
    const amount = Number(value);
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    return `ETB ${safeAmount.toLocaleString("en-ET", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}
export function formatCompactNumber(value) {
    return new Intl.NumberFormat("en", {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(value);
}
export function formatDate(value, token = "dd MMM yyyy") {
    return format(new Date(value), token);
}
export function formatDateTime(value) {
    return format(new Date(value), "dd MMM yyyy, HH:mm");
}
export function getInitials(name) {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}
export function toTitleCase(value) {
    return value
        .toLowerCase()
        .split(/[_\s-]+/)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ");
}
