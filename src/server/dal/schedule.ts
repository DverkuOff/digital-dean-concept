import "server-only";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "../db";
import { discipline, lesson } from "../db/schema";
import { requireStudent } from "../session";

export type LessonView = Awaited<ReturnType<typeof getMyLessons>>[number];

/** Пары своей группы в интервале [from, to). Группа берётся из сессии. */
export async function getMyLessons(from: Date, to: Date) {
  const me = await requireStudent();
  return db
    .select({
      id: lesson.id,
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
      discipline: discipline.name,
      disciplineShort: discipline.shortName,
    })
    .from(lesson)
    .innerJoin(discipline, eq(discipline.id, lesson.disciplineId))
    .where(and(eq(lesson.groupCode, me.groupCode), gte(lesson.startsAt, from), lt(lesson.startsAt, to)))
    .orderBy(asc(lesson.startsAt));
}
