import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";

// Белый список эндпоинтов Better Auth. Всё остальное — 404.
// Почему: логин и пароль демо-аккаунтов публичны, а Better Auth по умолчанию открывает
// change-password, update-user, revoke-sessions и др. — любой мог сломать вход всему жюри
// (находка аудита К1, docs/decisions.md). Тест: e2e/01-security.spec.ts.
const ALLOWED: Record<string, "GET" | "POST"> = {
  "/sign-in/username": "POST",
  "/sign-out": "POST",
  "/get-session": "GET",
};

const handler = toNextJsHandler(auth);

function allowed(req: Request) {
  const path = new URL(req.url).pathname.replace(/^\/api\/auth/, "").replace(/\/+$/, "");
  return ALLOWED[path] === req.method;
}

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  return allowed(req) ? handler.GET(req) : notFound();
}

export async function POST(req: Request) {
  return allowed(req) ? handler.POST(req) : notFound();
}
