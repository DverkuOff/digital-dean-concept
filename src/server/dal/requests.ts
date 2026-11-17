import "server-only";
import { and, asc, count, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { request, requestEvent } from "../db/schema";
import { requireStudent } from "../session";
import { isUuid } from "./ids";

export type MyRequest = Awaited<ReturnType<typeof listMyRequests>>[number];

/** Только свои заявки: фильтр по student_id из сессии. */
export async function listMyRequests() {
  const me = await requireStudent();
  return db.select().from(request).where(eq(request.studentId, me.id)).orderBy(desc(request.updatedAt));
}

/**
 * Своя заявка по id. Чужая или несуществующая → null (страница отдаёт 404).
 * Владелец проверяется в том же WHERE, а не после выборки.
 */
export async function getMyRequest(id: string) {
  if (!isUuid(id)) return null;
  const me = await requireStudent();
  const [row] = await db
    .select()
    .from(request)
    .where(and(eq(request.id, id), eq(request.studentId, me.id)))
    .limit(1);
  if (!row) return null;
  const events = await db
    .select()
    .from(requestEvent)
    .where(eq(requestEvent.requestId, row.id))
    .orderBy(asc(requestEvent.createdAt));
  return { ...row, events };
}

/** Номер заявки для людей: 2026-01042. */
export async function nextRequestNumber(tx: Pick<typeof db, "execute"> = db) {
  const res = await tx.execute(sql`select count(*)::int as n from ${request}`);
  const n = Number((res.rows[0] as { n: number }).n) + 1001;
  return `${new Date().getFullYear()}-${String(n).padStart(5, "0")}`;
}

/**
 * Место своей заявки в общей очереди «Подана» — только числа, без чужих данных.
 * Вызывать после того, как владелец уже проверен (getMyRequest).
 */
export async function queuePositionOf(r: { status: string; createdAt: Date }) {
  if (r.status !== "submitted") return null;
  const [ahead] = await db
    .select({ n: count() })
    .from(request)
    .where(and(eq(request.status, "submitted"), lt(request.createdAt, r.createdAt)));
  const [total] = await db.select({ n: count() }).from(request).where(eq(request.status, "submitted"));
  return { position: (ahead?.n ?? 0) + 1, total: total?.n ?? 1 };
}
