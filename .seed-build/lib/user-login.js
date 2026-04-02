import { isArchivedUsername } from "@/lib/user-archive";
const GENERATED_USER_USERNAME_PREFIX = "login.";
export function buildGeneratedUsername() {
    return `${GENERATED_USER_USERNAME_PREFIX}${crypto.randomUUID().replace(/-/g, "")}`;
}
export function isGeneratedUsername(username) {
    return Boolean(username?.startsWith(GENERATED_USER_USERNAME_PREFIX));
}
export function getUserDisplayUsername(input) {
    const displayUsername = input.displayUsername?.trim();
    if (displayUsername) {
        return displayUsername;
    }
    const username = input.username?.trim();
    if (!username || isArchivedUsername(username) || isGeneratedUsername(username)) {
        return "";
    }
    return username;
}
export function getUserLoginLabel(input) {
    return (getUserDisplayUsername(input) ||
        input.email?.trim().toLowerCase() ||
        input.phone?.trim() ||
        "-");
}
