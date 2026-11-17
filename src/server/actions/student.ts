"use server";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { dismissedCard, notification } from "../db/schema";
import { studentForAction } from "../session";
import { isUuid } from "../dal/ids";
import { isValidCardKey } from "@/lib/today/rules";

export async function markAllReadAction() {
  const me = await studentForAction();
  if (!me) return;
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.studentId, me.id), isNull(notification.readAt)));
  revalidatePath("/", "layout");
}

export async function markReadAction(id: string) {
  const me = await studentForAction();
  if (!me || !isUuid(id)) return;
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.id, id), eq(notification.studentId, me.id)));
  revalidatePath("/", "layout");
}

/** Кнопка «понял» на карточке «Сегодня». */
export async function dismissCardAction(cardKey: string) {
  const me = await studentForAction();
  if (!me || !isValidCardKey(cardKey)) return;
  await db.insert(dismissedCard).values({ studentId: me.id, cardKey }).onConflictDoNothing();
  revalidatePath("/today");
}
