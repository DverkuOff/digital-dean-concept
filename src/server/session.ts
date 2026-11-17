import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { student } from "./db/schema";

/** Сессия текущего запроса (одна на рендер благодаря cache). */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Для страниц: без сессии — на вход. */
export async function requireUser() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s.user;
}

/** Студент текущей сессии. Роль staff получает 404, а не чужие данные. */
export const requireStudent = cache(async () => {
  const user = await requireUser();
  if (user.role !== "student") notFound();
  const me = await db.query.student.findFirst({ where: eq(student.userId, user.id) });
  if (!me) notFound();
  return me;
});

/** Методист. Студент получает 404: страница для него «не существует». */
export async function requireStaff() {
  const user = await requireUser();
  if (user.role !== "staff") notFound();
  return user;
}

/*
 * Для Server Actions: они публичные POST-эндпоинты, поэтому проверка повторяется
 * внутри каждого action. Возвращаем null вместо redirect/notFound.
 */
export async function studentForAction() {
  const s = await getSession();
  if (!s || s.user.role !== "student") return null;
  return (await db.query.student.findFirst({ where: eq(student.userId, s.user.id) })) ?? null;
}

export async function staffForAction() {
  const s = await getSession();
  if (!s || s.user.role !== "staff") return null;
  return s.user;
}
