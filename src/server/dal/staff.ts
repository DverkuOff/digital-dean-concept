import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { request, requestMessage, student } from "../db/schema";
import { requireStaff } from "../session";
import type { RequestStatus } from "@/lib/requests/catalog";

const ACTIVE: RequestStatus[] = ["submitted", "in_progress", "returned", "ready"];

/** Очередь методиста. Доступ только роли staff (проверка в requireStaff). */
export async function listQueue(filter: "active" | "all" | RequestStatus) {
  await requireStaff();
  const where =
    filter === "all" ? undefined : filter === "active" ? inArray(request.status, ACTIVE) : eq(request.status, filter);
  return db
    .select({
      id: request.id,
      number: request.number,
      type: request.type,
      status: request.status,
      payload: request.payload,
      returnReason: request.returnReason,
      staffComment: request.staffComment,
      assigneeName: request.assigneeName,
      // Последнее сообщение в переписке — от студента: ждёт ответа учебного офиса.
      awaitingReply: sql<boolean>`coalesce((select ${requestMessage.author} = 'student' from ${requestMessage} where ${requestMessage.requestId} = ${request.id} order by ${requestMessage.createdAt} desc limit 1), false)`,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      studentName: sql<string>`${student.lastName} || ' ' || ${student.firstName}`,
      groupCode: student.groupCode,
    })
    .from(request)
    .innerJoin(student, eq(student.id, request.studentId))
    .where(where)
    .orderBy(
      sql`case ${request.status} when 'submitted' then 0 when 'in_progress' then 1 when 'returned' then 2 when 'ready' then 3 else 4 end`,
      asc(request.createdAt),
    );
}

export async function queueCounts() {
  await requireStaff();
  const rows = await db.select({ status: request.status, n: sql<number>`count(*)::int` }).from(request).groupBy(request.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<RequestStatus, number>>;
}

/** Переписка по заявкам из очереди — одним запросом. */
export async function messagesFor(requestIds: string[]) {
  await requireStaff();
  if (requestIds.length === 0) return new Map<string, (typeof requestMessage.$inferSelect)[]>();
  const rows = await db.select().from(requestMessage).where(inArray(requestMessage.requestId, requestIds)).orderBy(asc(requestMessage.createdAt));
  const m = new Map<string, (typeof requestMessage.$inferSelect)[]>();
  for (const r of rows) m.set(r.requestId, [...(m.get(r.requestId) ?? []), r]);
  return m;
}
