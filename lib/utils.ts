import { type ClassValue, clsx } from "clsx";
import { format } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string) {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return `ETB ${safeAmount.toLocaleString("en-ET", {
    maximumFractionDigits: 2,
  })}`;
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(value: Date | string, token = "dd MMM yyyy") {
  return format(new Date(value), token);
}

export function formatDateTime(value: Date | string) {
  return format(new Date(value), "dd MMM yyyy, HH:mm");
}

export function formatDateForInput(date: Date | string = new Date()) {
  return format(new Date(date), "yyyy-MM-dd'T'HH:mm");
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
