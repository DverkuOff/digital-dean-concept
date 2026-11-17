"use server";
// «Вопрос в учебный офис»: переписка внутри заявки.
// Студент пишет только в свою заявку (владелец — в WHERE), отвечает только методист.
import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { notification, request, requestMessage } from "../db/schema";
import { staffForAction, studentForAction } from "../session";
import { isUuid } from "../dal/ids";
import { getRequestType, requestName } from "@/lib/requests/catalog";

export type MessageState = { ok?: boolean; error?: string };
const MAX_LEN = 1000;
const MAX_PER_REQUEST = 30;

function readText(fd: FormData) {
  return String(fd.get("text") ?? "").trim();
}

async function tooMany(requestId: string) {
  const [row] = await db.select({ n: count() }).from(requestMessage).where(eq(requestMessage.requestId, requestId));
  return (row?.n ?? 0) >= MAX_PER_REQUEST;
}

export async function askOfficeAction(_prev: MessageState, fd: FormData): Promise<MessageState> {
  const me = await studentForAction();
  if (!me) return { error: "Сессия истекла. Войдите снова." };
  const id = String(fd.get("requestId") ?? "");
  const text = readText(fd);
  if (!isUuid(id)) return { error: "Заявка не найдена" };
  if (!text) return { error: "Напишите вопрос" };
  if (text.length > MAX_LEN) return { error: `Не длиннее ${MAX_LEN} символов` };

  const [own] = await db
    .select({ id: request.id })
    .from(request)
    .where(and(eq(request.id, id), eq(request.studentId, me.id)))
    .limit(1);
  if (!own) return { error: "Заявка не найдена" };
  if (await tooMany(own.id)) return { error: "В этой заявке уже много сообщений — позвоните в учебный офис" };

  await db.insert(requestMessage).values({ requestId: own.id, author: "student", authorName: `${me.firstName} ${me.lastName}`, text });
  revalidatePath(`/requests/${own.id}`);
  revalidatePath("/staff");
  return { ok: true };
}

export async function replyOfficeAction(_prev: MessageState, fd: FormData): Promise<MessageState> {
  const staff = await staffForAction();
  if (!staff) return { error: "Нет доступа" };
  const id = String(fd.get("requestId") ?? "");
  const text = readText(fd);
  if (!isUuid(id)) return { error: "Заявка не найдена" };
  if (!text) return { error: "Напишите ответ" };
  if (text.length > MAX_LEN) return { error: `Не длиннее ${MAX_LEN} символов` };

  const [row] = await db.select({ id: request.id, studentId: request.studentId, type: request.type }).from(request).where(eq(request.id, id)).limit(1);
  if (!row) return { error: "Заявка не найдена" };
  if (await tooMany(row.id)) return { error: "В этой заявке уже много сообщений" };

  await db.transaction(async (tx) => {
    await tx.insert(requestMessage).values({ requestId: row.id, author: "staff", authorName: staff.name, text });
    await tx.insert(notification).values({
      studentId: row.studentId,
      kind: "request",
      title: `Ответ учебного офиса: ${requestName(getRequestType(row.type), true)}`,
      body: text.length > 160 ? `${text.slice(0, 157)}…` : text,
      link: `/requests/${row.id}`,
    });
  });
  revalidatePath("/staff");
  return { ok: true };
}
