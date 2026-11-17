import { z } from "zod";

const uuid = z.uuid();

/** Невалидный id не доходит до БД (иначе Postgres ответит ошибкой 500). */
export function isUuid(v: unknown): v is string {
  return uuid.safeParse(v).success;
}
