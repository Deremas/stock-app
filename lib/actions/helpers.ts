import { Prisma } from "../../generated/prisma/client";

export function createDocumentNumber(prefix: string, date: Date = new Date()) {
  const datePart = date.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();

  return `${prefix}-${datePart}-${suffix}`;
}

export function getActionErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034"
  ) {
    return "Another transaction changed this record at the same time. Please try again.";
  }

  if (error instanceof Error && error.message.trim()) {
    const message = error.message.trim();
    const normalized = message.toLowerCase();

    if (
      normalized.includes("connection timeout") ||
      normalized.includes("connection terminated") ||
      normalized.includes("connection terminated unexpectedly") ||
      normalized.includes("can't reach database server") ||
      normalized.includes("timed out")
    ) {
      return "The service is temporarily unavailable right now. Please try again in a moment.";
    }

    return message;
  }

  return fallback;
}

export function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}

export function parseInputDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function toDecimal(value: number | string) {
  return new Prisma.Decimal(value);
}
