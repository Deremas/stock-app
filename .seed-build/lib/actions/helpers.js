import { Prisma } from "../../generated/prisma/client";
export function createDocumentNumber(prefix, date = new Date()) {
    const datePart = date.toISOString().slice(0, 10).replaceAll("-", "");
    const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
    return `${prefix}-${datePart}-${suffix}`;
}
export function getActionErrorMessage(error, fallback) {
    if (error instanceof Error && error.message.trim()) {
        const message = error.message.trim();
        const normalized = message.toLowerCase();
        if (normalized.includes("connection timeout") ||
            normalized.includes("connection terminated") ||
            normalized.includes("connection terminated unexpectedly") ||
            normalized.includes("can't reach database server") ||
            normalized.includes("timed out")) {
            return "The service is temporarily unavailable right now. Please try again in a moment.";
        }
        return message;
    }
    return fallback;
}
export function normalizeOptionalString(value) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}
export function parseInputDate(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed;
}
export function toDecimal(value) {
    return new Prisma.Decimal(value);
}
