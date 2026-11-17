"use server";
// Server Actions — публичные POST-эндпоинты: сессия и владелец проверяются здесь же,
// student_id никогда не берётся из формы. См. docs/specs/access-control.md.
import { and, eq, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { discipline, grade, request, requestEvent } from "../db/schema";
import { studentForAction } from "../session";
import { nextRequestNumber } from "../dal/requests";
import { isUuid } from "../dal/ids";
import { getRequestType } from "@/lib/requests/catalog";
import { validatePayload } from "@/lib/requests/validate";

export type FormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

function formValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  return out;
}

export async function createRequestAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await studentForAction();
  if (!me) return { error: "Сессия истекла. Войдите снова." };

  const def = getRequestType(String(fd.get("type") ?? ""));
  if (!def) return { error: "Неизвестный тип заявки" };

  const values = formValues(fd);
  const check = validatePayload(def, values);
  if (!check.ok) return { fieldErrors: check.errors, values };

  let id = "";
  for (let attempt = 0; attempt < 3 && !id; attempt++) {
    try {
      id = await db.transaction(async (tx) => {
        const number = await nextRequestNumber(tx);
        const [row] = await tx
          .insert(request)
          .values({ number, studentId: me.id, type: def.key, status: "submitted", payload: check.data })
          .returning({ id: request.id });
        await tx.insert(requestEvent).values({ requestId: row.id, status: "submitted", actor: "student" });
        return row.id;
      });
    } catch (e) {
      if (attempt === 2) throw e; // конфликт номера при одновременной подаче — пробуем ещё раз
    }
  }

  revalidatePath("/requests");
  redirect(`/requests/${id}?created=1`);
}

/** Повторная подача заявки, возвращённой с причиной. */
export async function resubmitRequestAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await studentForAction();
  if (!me) return { error: "Сессия истекла. Войдите снова." };

  const id = String(fd.get("requestId") ?? "");
  if (!isUuid(id)) return { error: "Заявка не найдена" };

  // Владелец — в условии выборки: чужая заявка неотличима от несуществующей.
  const [row] = await db
    .select()
    .from(request)
    .where(and(eq(request.id, id), eq(request.studentId, me.id)))
    .limit(1);
  if (!row) return { error: "Заявка не найдена" };
  if (row.status !== "returned") return { error: "Эту заявку сейчас нельзя изменить" };

  const def = getRequestType(row.type);
  if (!def) return { error: "Неизвестный тип заявки" };
  const values = formValues(fd);
  const check = validatePayload(def, values);
  if (!check.ok) return { fieldErrors: check.errors, values };

  await db.transaction(async (tx) => {
    await tx
      .update(request)
      .set({ payload: check.data, status: "submitted", returnReason: null, returnField: null, updatedAt: new Date() })
      .where(and(eq(request.id, row.id), eq(request.studentId, me.id)));
    await tx.insert(requestEvent).values({
      requestId: row.id,
      status: "submitted",
      actor: "student",
      comment: "Исправлена и подана повторно",
    });
  });

  revalidatePath(`/requests/${row.id}`);
  revalidatePath("/requests");
  return { ok: true };
}

/**
 * Режим пересдачи: одна кнопка создаёт обычную заявку в деканат.
 * Дисциплина проверяется по своим долгам на сервере; повторное нажатие ведёт к уже поданной заявке.
 */
export async function quickRetakeRequestAction(disciplineId: string, kind: "consultation" | "retake_application") {
  const me = await studentForAction();
  if (!me) redirect("/login");
  if (!isUuid(disciplineId) || !["consultation", "retake_application"].includes(kind)) redirect("/rating");

  const [debt] = await db
    .select({ name: discipline.name })
    .from(grade)
    .innerJoin(discipline, eq(discipline.id, grade.disciplineId))
    .where(and(eq(grade.studentId, me.id), eq(grade.disciplineId, disciplineId), eq(grade.status, "debt")))
    .limit(1);
  if (!debt) redirect("/rating");

  const [existing] = await db
    .select({ id: request.id })
    .from(request)
    .where(
      and(
        eq(request.studentId, me.id),
        eq(request.type, kind),
        inArray(request.status, ["submitted", "in_progress", "returned", "ready"]),
        sql`${request.payload}->>'discipline' = ${debt.name}`,
      ),
    )
    .limit(1);
  if (existing) redirect(`/requests/${existing.id}`);

  const payload: Record<string, string> =
    kind === "consultation"
      ? { discipline: debt.name, slot: "Будни после 14:00", question: "Подготовка к пересдаче: разобрать ошибки прошлой попытки" }
      : { discipline: debt.name, variant: "Записаться на ближайшую пересдачу", reason: "" };

  const id = await db.transaction(async (tx) => {
    const number = await nextRequestNumber(tx);
    const [row] = await tx
      .insert(request)
      .values({ number, studentId: me.id, type: kind, status: "submitted", payload })
      .returning({ id: request.id });
    await tx.insert(requestEvent).values({ requestId: row.id, status: "submitted", actor: "student", comment: "Подана из рейтинг-навигатора" });
    return row.id;
  });
  revalidatePath("/requests");
  redirect(`/requests/${id}?created=1`);
}
