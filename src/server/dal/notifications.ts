import "server-only";
import { and, desc, eq, isNull, or, count } from "drizzle-orm";
import { db } from "../db";
import { news, notification } from "../db/schema";
import { requireStudent } from "../session";

export async function listMyNotifications() {
  const me = await requireStudent();
  return db.select().from(notification).where(eq(notification.studentId, me.id)).orderBy(desc(notification.createdAt));
}

export async function countMyUnread() {
  const me = await requireStudent();
  const [row] = await db
    .select({ n: count() })
    .from(notification)
    .where(and(eq(notification.studentId, me.id), isNull(notification.readAt)));
  return row?.n ?? 0;
}

/** Новости деканата: общие и своего факультета. */
export async function listNews() {
  const me = await requireStudent();
  return db
    .select()
    .from(news)
    .where(or(isNull(news.faculty), eq(news.faculty, me.faculty)))
    .orderBy(desc(news.publishedAt));
}
