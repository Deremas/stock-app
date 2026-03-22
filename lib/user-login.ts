import { isArchivedUsername } from "@/lib/user-archive";

const GENERATED_USER_USERNAME_PREFIX = "login.";

export function buildGeneratedUsername() {
  return `${GENERATED_USER_USERNAME_PREFIX}${crypto.randomUUID().replace(/-/g, "")}`;
}

export function isGeneratedUsername(username?: string | null) {
  return Boolean(username?.startsWith(GENERATED_USER_USERNAME_PREFIX));
}

export function getUserDisplayUsername(input: {
  displayUsername?: string | null;
  username?: string | null;
}) {
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

export function getUserLoginLabel(input: {
  displayUsername?: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  return (
    getUserDisplayUsername(input) ||
    input.email?.trim().toLowerCase() ||
    input.phone?.trim() ||
    "-"
  );
}
