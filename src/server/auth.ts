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
    "/update-session",
    "/unlink-account",
    "/link-social",
    "/sign-in/social",
    "/verify-password",
    "/account-info",
    "/get-access-token",
    "/refresh-token",
    "/delete-user/callback",
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
      // Пароль демо публичный, поэтому лимит не про жюри, а против перебора чужих аккаунтов.
      // 30 в минуту на IP: несколько экспертов за одним NAT не мешают друг другу.
      "/sign-in/username": { window: 60, max: 30 },
    },
  },
  advanced: {
    // IP клиента за прокси хостинга (находка аудита В1). Better Auth доверяет X-Forwarded-For
    // только с одним адресом; цепочку «клиент, прокси» разбирает по AUTH_TRUSTED_PROXIES,
    // иначе берёт X-Real-IP, который выставляет ингресс. После деплоя проверить заголовки (README).
    ipAddress: {
      ipAddressHeaders: (process.env.AUTH_IP_HEADERS ?? "x-forwarded-for,x-real-ip")
        .split(",")
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean),
      trustedProxies: (process.env.AUTH_TRUSTED_PROXIES ?? "")
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean),
    },
    // Куки сессии: httpOnly + SameSite=Lax (по умолчанию), Secure на https.
    useSecureCookies: process.env.BETTER_AUTH_URL?.startsWith("https://") ?? false,
  },
  plugins: [username(), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
