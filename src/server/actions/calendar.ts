"use server";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { calendarToken } from "../db/schema";
import { studentForAction } from "../session";
import { hashToken, newToken } from "../dal/calendar";

/**
 * Выпустить или перевыпустить личную ссылку на календарь.
 * Токен возвращается один раз; в БД — только хеш. Перевыпуск делает старую ссылку недействительной.
 */
export async function issueCalendarTokenAction(): Promise<{ token?: string; error?: string }> {
  const me = await studentForAction();
  if (!me) return { error: "Сессия истекла. Войдите снова." };
  const token = newToken();
  await db
    .insert(calendarToken)
    .values({ studentId: me.id, tokenHash: hashToken(token) })
    .onConflictDoUpdate({ target: calendarToken.studentId, set: { tokenHash: hashToken(token), createdAt: new Date(), lastUsedAt: null } });
  revalidatePath("/schedule/calendar");
  return { token };
}
