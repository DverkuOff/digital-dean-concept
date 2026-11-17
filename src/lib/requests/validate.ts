import type { RequestTypeDef } from "./catalog";

export type PayloadResult =
  | { ok: true; data: Record<string, string> }
  | { ok: false; errors: Record<string, string> };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Проверка полей заявки по описанию типа. Неизвестные поля отбрасываются. */
export function validatePayload(def: RequestTypeDef, raw: Record<string, unknown>): PayloadResult {
  const data: Record<string, string> = {};
  const errors: Record<string, string> = {};

  for (const f of def.fields) {
    const v = typeof raw[f.name] === "string" ? (raw[f.name] as string).trim() : "";
    if (!v) {
      if (f.required) errors[f.name] = "Заполните поле";
      continue;
    }
    switch (f.kind) {
      case "text":
      case "textarea": {
        const max = f.maxLength ?? 500;
        if (v.length > max) errors[f.name] = `Не длиннее ${max} символов`;
        break;
      }
      case "number": {
        const n = Number(v);
        if (!Number.isInteger(n) || n < f.min || n > f.max) errors[f.name] = `Число от ${f.min} до ${f.max}`;
        break;
      }
      case "date":
        if (!DATE_RE.test(v) || Number.isNaN(Date.parse(v))) errors[f.name] = "Укажите дату";
        break;
      case "select":
        if (!f.options.includes(v)) errors[f.name] = "Выберите вариант из списка";
        break;
    }
    if (!errors[f.name]) data[f.name] = v;
  }

  if (def.key === "absence_excuse" && data.dateFrom && data.dateTo && data.dateFrom > data.dateTo) {
    errors.dateTo = "Дата окончания раньше даты начала";
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}
