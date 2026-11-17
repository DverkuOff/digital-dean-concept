"use server";
// Заметка к паре. Пара должна быть из группы студента; автор — только из сессии.
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { lesson, lessonNote } from "../db/schema";
import { studentForAction } from "../session";
import { isUuid } from "../dal/ids";

export type NoteState = { ok?: boolean; error?: string; text?: string };
const MAX = 500;

export async function saveLessonNoteAction(_prev: NoteState, fd: FormData): Promise<NoteState> {
  const me = await studentForAction();
  if (!me) return { error: "Сессия истекла. Войдите снова." };
  const lessonId = String(fd.get("lessonId") ?? "");
  const text = String(fd.get("text") ?? "").trim();
  if (!isUuid(lessonId)) return { error: "Пара не найдена" };
  if (text.length > MAX) return { error: `Не длиннее ${MAX} символов`, text };

  // Пара своей группы — в условии выборки; чужая неотличима от несуществующей.
  const [own] = await db
    .select({ id: lesson.id })
    .from(lesson)
    .where(and(eq(lesson.id, lessonId), eq(lesson.groupCode, me.groupCode)))
    .limit(1);
  if (!own) return { error: "Пара не найдена" };

  if (!text) {
    await db.delete(lessonNote).where(and(eq(lessonNote.studentId, me.id), eq(lessonNote.lessonId, own.id)));
  } else {
    await db
      .insert(lessonNote)
      .values({ studentId: me.id, lessonId: own.id, text })
      .onConflictDoUpdate({ target: [lessonNote.studentId, lessonNote.lessonId], set: { text, updatedAt: new Date() } });
  }
  revalidatePath("/schedule");
  revalidatePath("/today");
  return { ok: true, text };
}
