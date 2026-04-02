export const ARCHIVED_USER_USERNAME_PREFIX = "deleted-user-";
export function buildArchivedUsername(userId) {
    return `${ARCHIVED_USER_USERNAME_PREFIX}${userId}`;
}
export function isArchivedUsername(username) {
    return Boolean(username?.startsWith(ARCHIVED_USER_USERNAME_PREFIX));
}
