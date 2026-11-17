import "server-only";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "../db";
import { discipline, lesson, lessonNote } from "../db/schema";
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
      note: lessonNote.text,
    })
    .from(lesson)
    .innerJoin(discipline, eq(discipline.id, lesson.disciplineId))
    // Только своя заметка: условие на автора — в самом JOIN.
    .leftJoin(lessonNote, and(eq(lessonNote.lessonId, lesson.id), eq(lessonNote.studentId, me.id)))
    .where(and(eq(lesson.groupCode, me.groupCode), gte(lesson.startsAt, from), lt(lesson.startsAt, to)))
    .orderBy(asc(lesson.startsAt));
}
