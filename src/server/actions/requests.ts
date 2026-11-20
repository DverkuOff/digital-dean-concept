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

/** Не больше 10 активных заявок у студента: защита очереди от залива скриптом (находка аудита М6). */
const MAX_ACTIVE_REQUESTS = 10;
const LIMIT = "limit"; // признак «лимит исчерпан» из транзакции подачи
const ACTIVE_STATUSES = ["submitted", "in_progress", "returned", "ready"] as const;
/** Заявление на пересдачу по дисциплине одно: и активное, и уже принятое (done) — второе не нужно. */
const RETAKE_APP_TAKEN = [...ACTIVE_STATUSES, "done"] as const;
const DUPLICATE = "duplicate";

async function activeCount(studentId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(request)
    .where(and(eq(request.studentId, studentId), inArray(request.status, [...ACTIVE_STATUSES])));
  return row?.n ?? 0;
}

export type FormState = {
  ok?: boolean;
  error?: string;
  /** Ссылка к ошибке формы (например, на уже поданное заявление). */
  errorLink?: { href: string; label: string };
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

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
  const limitError = { error: `У вас уже ${MAX_ACTIVE_REQUESTS} активных заявок. Дождитесь, пока учебный офис закроет часть из них.`, values };
  if ((await activeCount(me.id)) >= MAX_ACTIVE_REQUESTS) return limitError;

  let id = "";
  let duplicate: { id: string; number: string } | null = null;
  for (let attempt = 0; attempt < 3 && !id; attempt++) {
    try {
      id = await db.transaction(async (tx) => {
        // Подсчёт и вставка под блокировкой студента: параллельные подачи не обойдут лимит.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${me.id}))`);
        // Заявление на пересдачу по той же дисциплине уже есть (в том числе поданное из рейтинга) — второе не создаём.
        if (def.key === "retake_application") {
          const [dup] = await tx
            .select({ id: request.id, number: request.number })
            .from(request)
            .where(
              and(
                eq(request.studentId, me.id),
                eq(request.type, "retake_application"),
                inArray(request.status, [...RETAKE_APP_TAKEN]),
                sql`lower(trim(${request.payload}->>'discipline')) = lower(${check.data.discipline ?? ""})`,
              ),
            )
            .limit(1);
          if (dup) {
            duplicate = dup;
            return DUPLICATE;
          }
        }
        const [cnt] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(request)
          .where(and(eq(request.studentId, me.id), inArray(request.status, [...ACTIVE_STATUSES])));
        if ((cnt?.n ?? 0) >= MAX_ACTIVE_REQUESTS) return LIMIT;
        const number = await nextRequestNumber(tx);
        const [row] = await tx
          .insert(request)
          .values({ number, studentId: me.id, type: def.key, status: "submitted", payload: check.data })
          .returning({ id: request.id });
        await tx.insert(requestEvent).values({ requestId: row.id, status: "submitted", actor: "student" });
        return row.id;
      });
    } catch (e) {
      if (attempt === 2) throw e; // сбой транзакции — пробуем ещё раз
    }
  }
  if (id === LIMIT) return limitError;
  if (id === DUPLICATE && duplicate) {
    const d: { id: string; number: string } = duplicate;
    return { error: `Заявление по этой дисциплине уже подано: № ${d.number}.`, errorLink: { href: `/requests/${d.id}`, label: "Открыть заявление" }, values };
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

  const applied = await db.transaction(async (tx) => {
    // Условие на статус «returned» — в том же UPDATE: двойная отправка не создаст два события.
    const updated = await tx
      .update(request)
      .set({ payload: check.data, status: "submitted", returnReason: null, returnField: null, updatedAt: new Date() })
      .where(and(eq(request.id, row.id), eq(request.studentId, me.id), eq(request.status, "returned")))
      .returning({ id: request.id });
    if (updated.length === 0) return false;
    await tx.insert(requestEvent).values({
      requestId: row.id,
      status: "submitted",
      actor: "student",
      comment: "Исправлена и подана повторно",
    });
    return true;
  });
  if (!applied) return { error: "Эту заявку сейчас нельзя изменить" };

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

  const payload: Record<string, string> =
    kind === "consultation"
      ? { discipline: debt.name, slot: "Будни после 14:00", question: "Подготовка к пересдаче: разобрать ошибки прошлой попытки" }
      : { discipline: debt.name, variant: "Записаться на ближайшую пересдачу", reason: "" };

  // Проверка «уже есть такая заявка» и вставка — под той же блокировкой студента, что и обычная подача:
  // двойной клик или параллельные запросы не создают дубли.
  const outcome = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${me.id}))`);
    const [existing] = await tx
      .select({ id: request.id })
      .from(request)
      .where(
        and(
          eq(request.studentId, me.id),
          eq(request.type, kind),
          inArray(request.status, kind === "retake_application" ? [...RETAKE_APP_TAKEN] : [...ACTIVE_STATUSES]),
          sql`${request.payload}->>'discipline' = ${debt.name}`,
        ),
      )
      .limit(1);
    if (existing) return { existing: existing.id } as const;
    const [cnt] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(request)
      .where(and(eq(request.studentId, me.id), inArray(request.status, [...ACTIVE_STATUSES])));
    if ((cnt?.n ?? 0) >= MAX_ACTIVE_REQUESTS) return { limit: true } as const;
    const number = await nextRequestNumber(tx);
    const [row] = await tx
      .insert(request)
      .values({ number, studentId: me.id, type: kind, status: "submitted", payload })
      .returning({ id: request.id });
    await tx.insert(requestEvent).values({ requestId: row.id, status: "submitted", actor: "student", comment: "Подана из рейтинг-навигатора" });
    return { id: row.id } as const;
  });
  if ("existing" in outcome) redirect(`/requests/${outcome.existing}`);
  if ("limit" in outcome) redirect("/requests");
  const id = outcome.id;
  revalidatePath("/requests");
  redirect(`/requests/${id}?created=1`);
}
