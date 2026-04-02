import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
const globalForPrisma = globalThis;
if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to initialize Prisma.");
}
function normalizeDatabaseUrl(value) {
    const url = new URL(value);
    const sslMode = url.searchParams.get("sslmode");
    // Keep Neon-compatible TLS behavior while matching the newer pg/libpq
    // expectation explicitly so development does not emit alias warnings.
    if (url.searchParams.get("channel_binding") === "require") {
        url.searchParams.delete("channel_binding");
    }
    if (!sslMode) {
        url.searchParams.set("sslmode", "verify-full");
    }
    else if (["prefer", "require", "verify-ca"].includes(sslMode)) {
        url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
}
function toPositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
const pool = globalForPrisma.prismaPool ??
    new Pool({
        connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL),
        max: toPositiveInteger(process.env.PG_POOL_MAX, process.env.NODE_ENV === "development" ? 10 : 5),
        idleTimeoutMillis: toPositiveInteger(process.env.PG_IDLE_TIMEOUT_MS, 30_000),
        connectionTimeoutMillis: toPositiveInteger(process.env.PG_CONNECTION_TIMEOUT_MS, 30_000),
    });
const adapter = globalForPrisma.prismaAdapter ??
    new PrismaPg(pool, {
        onPoolError: (error) => {
            console.error("Prisma pool error", error);
        },
        onConnectionError: (error) => {
            console.error("Prisma connection error", error);
        },
    });
export const prisma = globalForPrisma.prisma ??
    new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prismaPool = pool;
    globalForPrisma.prismaAdapter = adapter;
    globalForPrisma.prisma = prisma;
}
