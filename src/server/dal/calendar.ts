import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "../db";
import { calendarToken, discipline, lesson, student } from "../db/schema";
import { requireStudent } from "../session";
import { addDays, startOfMskDay } from "@/lib/dates";

// Формат токена: 32 случайных байта в base64url (43 символа).
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

/** Есть ли у меня ссылка и когда выпущена (сам токен не хранится). */
export async function getMyCalendarStatus() {
  const me = await requireStudent();
  const [row] = await db
    .select({ createdAt: calendarToken.createdAt, lastUsedAt: calendarToken.lastUsedAt })
    .from(calendarToken)
    .where(eq(calendarToken.studentId, me.id))
    .limit(1);
  return row ?? null;
}

/**
 * Календарь по токену — без сессии: календарные приложения не шлют cookie.
 * Токен и есть пропуск, поэтому: строгий формат, поиск по хешу, неизвестный → null (404).
 */
export async function getCalendarByToken(rawToken: string) {
  const token = rawToken.replace(/\.ics$/, "");
  if (!TOKEN_RE.test(token)) return null;
  const [owner] = await db
    .select({ studentId: calendarToken.studentId, groupCode: student.groupCode })
    .from(calendarToken)
    .innerJoin(student, eq(student.id, calendarToken.studentId))
    .where(eq(calendarToken.tokenHash, hashToken(token)))
    .limit(1);
  if (!owner) return null;

  await db.update(calendarToken).set({ lastUsedAt: new Date() }).where(eq(calendarToken.studentId, owner.studentId));

  const today = startOfMskDay(new Date());
  const lessons = await db
    .select({
      id: lesson.id,
      title: discipline.name,
      type: lesson.type,
      startsAt: lesson.startsAt,
      endsAt: lesson.endsAt,
      room: lesson.room,
      teacher: lesson.teacher,
      status: lesson.status,
      originalStartsAt: lesson.originalStartsAt,
      originalRoom: lesson.originalRoom,
      changeNote: lesson.changeNote,
      changedAt: lesson.changedAt,
    })
    .from(lesson)
    .innerJoin(discipline, eq(discipline.id, lesson.disciplineId))
    .where(and(eq(lesson.groupCode, owner.groupCode), gte(lesson.startsAt, addDays(today, -14)), lt(lesson.startsAt, addDays(today, 70))))
    .orderBy(asc(lesson.startsAt));
  return { groupCode: owner.groupCode, lessons };
}
