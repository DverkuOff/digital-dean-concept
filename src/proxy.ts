import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Оптимистичный редирект на вход по наличию cookie. Это НЕ защита:
// настоящая проверка сессии, роли и владельца — в DAL (src/server/session.ts, src/server/dal).
export function proxy(req: NextRequest) {
  const hasSession = Boolean(getSessionCookie(req));
  const { pathname } = req.nextUrl;
  if (!hasSession && pathname !== "/login") {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|api/calendar|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|robots.txt|sw.js|offline.html|icons/).*)"],
};
