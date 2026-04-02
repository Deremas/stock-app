const DEFAULT_RETURN_TO = "/dashboard";
export function sanitizeReturnToPath(value, fallback = DEFAULT_RETURN_TO) {
    if (!value) {
        return fallback;
    }
    try {
        const normalized = decodeURIComponent(value).trim();
        if (!normalized.startsWith("/") || normalized.startsWith("//")) {
            return fallback;
        }
        if (normalized.startsWith("/login")) {
            return fallback;
        }
        return normalized;
    }
    catch {
        return fallback;
    }
}
