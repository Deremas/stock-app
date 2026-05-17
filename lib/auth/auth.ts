import argon2 from "argon2";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";

import { prisma } from "@/lib/prisma";

const oneDayInSeconds = 60 * 60 * 24;
const authUnavailableMessage =
  "Sign-in is temporarily unavailable. Please try again in a moment.";
const localhostAuthURL = "http://localhost:3000";

function getVercelURL(value: string | undefined) {
  if (!value) {
    return null;
  }

  return value.startsWith("http") ? value : `https://${value}`;
}

function getAuthBaseURL() {
  const configuredURL = process.env.BETTER_AUTH_URL;

  if (process.env.NODE_ENV !== "production") {
    return configuredURL ?? localhostAuthURL;
  }

  const vercelProductionURL = getVercelURL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  );
  const vercelDeploymentURL = getVercelURL(process.env.VERCEL_URL);
  const fallback =
    configuredURL && !configuredURL.includes("localhost")
      ? configuredURL
      : vercelProductionURL ?? vercelDeploymentURL ?? localhostAuthURL;

  return {
    allowedHosts: [
      "the-stock-app.vercel.app",
      "*.vercel.app",
      ...[configuredURL, vercelProductionURL, vercelDeploymentURL]
        .map((url) => {
          if (!url) {
            return null;
          }

          try {
            return new URL(url).host;
          } catch {
            return null;
          }
        })
        .filter((host): host is string => Boolean(host)),
    ],
    fallback,
    protocol: "https" as const,
  };
}

function normalizePhoneIdentifier(value: string) {
  return value.replace(/\D/g, "");
}

function createAuthError(
  code:
    | "AUTH_TEMPORARILY_UNAVAILABLE"
    | "USER_INACTIVE"
    | "EMAIL_NOT_FOUND"
    | "USERNAME_NOT_FOUND"
    | "PHONE_NOT_FOUND"
    | "PHONE_LOGIN_AMBIGUOUS",
  message: string,
  status: "FORBIDDEN" | "UNAUTHORIZED" | "BAD_REQUEST" | "INTERNAL_SERVER_ERROR",
) {
  return APIError.from(status, {
    code,
    message,
  });
}

function isAuthInfrastructureError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalized = error.message.toLowerCase();

  return (
    normalized.includes("connection timeout") ||
    normalized.includes("connection terminated") ||
    normalized.includes("connection terminated unexpectedly") ||
    normalized.includes("can't reach database server") ||
    normalized.includes("timed out")
  );
}

function rethrowAuthAvailabilityError(error: unknown): never {
  if (error instanceof APIError) {
    throw error;
  }

  if (isAuthInfrastructureError(error)) {
    throw createAuthError(
      "AUTH_TEMPORARILY_UNAVAILABLE",
      authUnavailableMessage,
      "INTERNAL_SERVER_ERROR",
    );
  }

  throw error;
}

export const auth = betterAuth({
  appName: "Stock Management App",
  baseURL: getAuthBaseURL(),
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "dev-only-secret-change-this-before-production",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    minPasswordLength: 4,
    maxPasswordLength: 128,
    password: {
      hash: async (password) => argon2.hash(password),
      verify: async ({ hash, password }) => argon2.verify(hash, password),
    },
  },
  session: {
    expiresIn: oneDayInSeconds,
    updateAge: oneDayInSeconds,
    additionalFields: {
      activeBranchId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: true,
        unique: true,
      },
      phone: {
        type: "string",
        required: false,
      },
      displayUsername: {
        type: "string",
        required: false,
      },
      displayName: {
        type: "string",
        required: false,
      },
      role: {
        type: "string",
        required: true,
        defaultValue: "SALES",
        input: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
      defaultBranchId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email" && ctx.path !== "/sign-in/username") {
        return;
      }

      try {
        const body = ctx.body as {
          email?: unknown;
          username?: unknown;
        };

        if (typeof body.email === "string") {
          const email = body.email.trim().toLowerCase();

          if (!email) {
            return;
          }

          body.email = email;

          const user = await ctx.context.adapter.findOne<{
            isActive?: boolean;
          }>({
            model: "user",
            where: [
              {
                field: "email",
                value: email,
              },
            ],
          });

          if (!user) {
            throw createAuthError("EMAIL_NOT_FOUND", "Email is incorrect.", "UNAUTHORIZED");
          }

          if (user.isActive === false) {
            throw createAuthError(
              "USER_INACTIVE",
              "This user account is inactive.",
              "FORBIDDEN",
            );
          }

          return;
        }

        if (typeof body.username !== "string") {
          return;
        }

        const rawUsername = body.username.trim();

        if (!rawUsername) {
          return;
        }

        const normalizedUsername = rawUsername.toLowerCase();
        const phoneDigits = normalizePhoneIdentifier(rawUsername);
        const isPhoneCandidate =
          phoneDigits.length >= 7 && !/[a-z]/i.test(rawUsername);

        let resolvedUser = await ctx.context.adapter.findOne<{
          id: string;
          username?: string;
          isActive?: boolean;
        }>({
          model: "user",
          where: [
            {
              field: "username",
              value: normalizedUsername,
            },
          ],
        });

        if (!resolvedUser && isPhoneCandidate) {
          const phoneMatches = await prisma.user.findMany({
            where: {
              phone: {
                not: null,
              },
            },
            select: {
              id: true,
              username: true,
              phone: true,
              isActive: true,
            },
          });

          const matchingUsers = phoneMatches.filter(
            (user) =>
              normalizePhoneIdentifier(user.phone ?? "") === phoneDigits,
          );

          if (matchingUsers.length > 1) {
            throw createAuthError(
              "PHONE_LOGIN_AMBIGUOUS",
              "This phone number matches multiple accounts. Sign in with username or email.",
              "BAD_REQUEST",
            );
          }

          const match = matchingUsers[0];

          if (match) {
            resolvedUser = {
              id: match.id,
              username: match.username,
              isActive: match.isActive,
            };
            body.username = match.username;
          } else {
            throw createAuthError(
              "PHONE_NOT_FOUND",
              "Phone number is incorrect.",
              "UNAUTHORIZED",
            );
          }
        } else {
          body.username = normalizedUsername;
        }

        if (!resolvedUser && !isPhoneCandidate) {
          throw createAuthError(
            "USERNAME_NOT_FOUND",
            "Username is incorrect.",
            "UNAUTHORIZED",
          );
        }

        if (resolvedUser?.isActive === false) {
          throw createAuthError(
            "USER_INACTIVE",
            "This user account is inactive.",
            "FORBIDDEN",
          );
        }
      } catch (error) {
        rethrowAuthAvailabilityError(error);
      }
    }),
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 40,
    }),
    nextCookies(),
  ],
});
