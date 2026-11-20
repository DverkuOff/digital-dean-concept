import "server-only";
import { and, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "../db";
import { discipline, dismissedCard, examAttempt, lesson, news, notification, request } from "../db/schema";
import { requireStudent } from "../session";
import { buildTodayCards, type TodayInput } from "@/lib/today/rules";
import { addDays, startOfMskDay } from "@/lib/dates";

/** Собирает события ядра (только свои) и превращает их в карточки «Сегодня» по правилам. */
export async function getTodayCards(now = new Date()) {
  const me = await requireStudent();
  const today = startOfMskDay(now);

  const [changes, retakes, reqs, deadlines, important, dismissed] = await Promise.all([
    db
      .select({
        id: lesson.id,
        status: lesson.status,
        startsAt: lesson.startsAt,
        originalStartsAt: lesson.originalStartsAt,
        room: lesson.room,
        originalRoom: lesson.originalRoom,
        changeNote: lesson.changeNote,
        discipline: discipline.name,
      })
      .from(lesson)
      .innerJoin(discipline, eq(discipline.id, lesson.disciplineId))
      .where(
        and(
          eq(lesson.groupCode, me.groupCode),
          inArray(lesson.status, ["moved", "room_changed", "cancelled"]),
          gte(lesson.startsAt, now),
          lt(lesson.startsAt, addDays(today, 3)),
        ),
      ),
    db
      .select({ id: examAttempt.id, kind: examAttempt.kind, scheduledAt: examAttempt.scheduledAt, room: examAttempt.room, discipline: discipline.name })
      .from(examAttempt)
      .innerJoin(discipline, eq(discipline.id, examAttempt.disciplineId))
      .where(
        and(
          eq(examAttempt.studentId, me.id),
          eq(examAttempt.result, "scheduled"),
          inArray(examAttempt.kind, ["retake1", "retake2", "commission"]),
          gte(examAttempt.scheduledAt, now),
          lt(examAttempt.scheduledAt, addDays(today, 21)),
        ),
      ),
    db
      .select({ id: request.id, type: request.type, status: request.status, updatedAt: request.updatedAt, returnReason: request.returnReason, staffComment: request.staffComment })
      .from(request)
      .where(
        and(
          eq(request.studentId, me.id),
          // Поданное и взятое в работу заявление на пересдачу нужно, чтобы «Сегодня» не просила подать его снова.
          or(inArray(request.status, ["returned", "ready"]), and(eq(request.type, "retake_application"), inArray(request.status, ["submitted", "in_progress"]))),
        ),
      ),
    db
      .select({ id: notification.id, title: notification.title, body: notification.body, link: notification.link, dueAt: notification.dueAt })
      .from(notification)
      .where(
        and(
          eq(notification.studentId, me.id),
          eq(notification.kind, "deadline"),
          gte(notification.dueAt, now),
          lt(notification.dueAt, addDays(today, 10)),
        ),
      ),
    db
      .select({ id: news.id, title: news.title, body: news.body, publishedAt: news.publishedAt })
      .from(news)
      .where(and(eq(news.important, true), gte(news.publishedAt, addDays(now, -7)), or(isNull(news.faculty), eq(news.faculty, me.faculty)))),
    db.select({ key: dismissedCard.cardKey }).from(dismissedCard).where(eq(dismissedCard.studentId, me.id)),
  ]);

  const input: TodayInput = {
    now,
    lessonChanges: changes,
    retakes: retakes.filter((r) => r.scheduledAt !== null) as TodayInput["retakes"],
    requests: reqs,
    deadlines: deadlines.filter((d) => d.dueAt !== null) as TodayInput["deadlines"],
    news: important,
    dismissed: new Set(dismissed.map((d) => d.key)),
  };
  return buildTodayCards(input);
}
