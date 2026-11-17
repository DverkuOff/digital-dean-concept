"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { notification, request, requestEvent } from "../db/schema";
import { staffForAction } from "../session";
import { isUuid } from "../dal/ids";
import {
  COMMENT_REQUIRED,
  STAFF_TRANSITIONS,
  STATUS_META,
  getRequestType,
  requestName,
  type RequestStatus,
} from "@/lib/requests/catalog";

export type StaffState = { ok?: boolean; error?: string };

const ALL: RequestStatus[] = ["submitted", "in_progress", "returned", "ready", "done", "rejected"];

export async function changeStatusAction(_prev: StaffState, fd: FormData): Promise<StaffState> {
  const staff = await staffForAction();
  if (!staff) return { error: "Нет доступа" };

  const id = String(fd.get("requestId") ?? "");
  const to = String(fd.get("to") ?? "") as RequestStatus;
  const comment = String(fd.get("comment") ?? "").trim().slice(0, 1000);
  const returnField = String(fd.get("returnField") ?? "").trim() || null;
  if (!isUuid(id) || !ALL.includes(to)) return { error: "Некорректный запрос" };

  const [row] = await db.select().from(request).where(eq(request.id, id)).limit(1);
  if (!row) return { error: "Заявка не найдена" };
  if (!STAFF_TRANSITIONS[row.status].includes(to)) {
    return { error: `Из статуса «${STATUS_META[row.status].label}» так перевести нельзя` };
  }
  if (COMMENT_REQUIRED.includes(to) && !comment) return { error: "Напишите причину — студент увидит её в заявке" };

  const def = getRequestType(row.type);
  // «Готово» без комментария: подставляем, где получить документ.
  const finalComment =
    to === "ready" && !comment
      ? row.payload.format === "Электронная с электронной подписью"
        ? "Документ с электронной подписью отправлен на почту и доступен в учебном офисе"
        : "Документ готов. Забрать в учебном офисе, каб. 1107, пн–пт 10:00–17:00, с паспортом"
      : comment;
  const field = def?.fields.find((f) => f.name === returnField)?.name ?? null;

  // Переход — одним UPDATE с условием на текущий статус: если два методиста нажали одновременно,
  // второй получит 0 строк, а не двойной переход и два уведомления (находка аудита М5).
  const applied = await db.transaction(async (tx) => {
    const updated = await tx
      .update(request)
      .set({
        status: to,
        updatedAt: new Date(),
        returnReason: to === "returned" ? comment : null,
        returnField: to === "returned" ? field : null,
        staffComment: to === "ready" || to === "rejected" ? finalComment || null : row.staffComment,
        // Кто ведёт: методист, который первым взял заявку в работу или вернул её.
        assigneeName: row.assigneeName ?? staff.name,
      })
      .where(and(eq(request.id, id), eq(request.status, row.status)))
      .returning({ id: request.id });
    if (updated.length === 0) return false;
    await tx.insert(requestEvent).values({ requestId: id, status: to, actor: "staff", comment: finalComment || null });
    const name = requestName(def, true);
    const title =
      to === "ready"
        ? `Готово: ${name}`
        : to === "returned"
          ? `Заявку вернули: ${name}`
          : to === "in_progress"
            ? `Взяли в работу: ${name}`
            : `${STATUS_META[to].label}: ${name}`;
    await tx.insert(notification).values({
      studentId: row.studentId,
      kind: "request",
      title,
      body: finalComment || STATUS_META[to].hint,
      link: `/requests/${id}`,
    });
    return true;
  });
  if (!applied) return { error: "Заявку уже обработал другой сотрудник — обновите очередь" };

  revalidatePath("/staff");
  return { ok: true };
}
