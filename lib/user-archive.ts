export const ARCHIVED_USER_USERNAME_PREFIX = "deleted-user-";

export function buildArchivedUsername(userId: string) {
  return `${ARCHIVED_USER_USERNAME_PREFIX}${userId}`;
}

export function isArchivedUsername(username?: string | null) {
  return Boolean(username?.startsWith(ARCHIVED_USER_USERNAME_PREFIX));
}
