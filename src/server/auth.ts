import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { db } from "./db";
import * as schema from "./db/schema";
import { hashPassword, verifyPassword } from "./password";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  // Второй рубеж к белому списку в app/api/auth/[...all]/route.ts: эти пути выключены и в самом Better Auth.
  disabledPaths: [
    "/sign-up/email",
    "/sign-in/email",
    "/change-password",
    "/set-password",
    "/update-user",
    "/change-email",
    "/delete-user",
    "/revoke-session",
    "/revoke-sessions",
    "/revoke-other-sessions",
    "/list-sessions",
    "/list-accounts",
    "/is-username-available",
    "/request-password-reset",
    "/reset-password",
    "/send-verification-email",
    "/verify-email",
  ],
  emailAndPassword: {
    enabled: true,
    // Регистрации нет: аккаунты создаёт деканат (в демо — сид).
    disableSignUp: true,
    minPasswordLength: 8,
    password: { hash: hashPassword, verify: verifyPassword },
  },
  user: {
    additionalFields: {
      // input: false — роль нельзя передать с клиента.
      role: { type: "string", input: false, defaultValue: "student" },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/username": { window: 60, max: 10 },
    },
  },
  advanced: {
    // Куки сессии: httpOnly + SameSite=Lax (по умолчанию), Secure на https.
    useSecureCookies: process.env.BETTER_AUTH_URL?.startsWith("https://") ?? false,
  },
  plugins: [username(), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
