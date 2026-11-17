import type { RequestTypeDef } from "./catalog";

export type PayloadResult =
  | { ok: true; data: Record<string, string> }
  | { ok: false; errors: Record<string, string> };

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const RU_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

/**
 * Дата из формы: «дд.мм.гггг» или «гггг-мм-дд» → «гггг-мм-дд».
 * null — нет такой даты (31 февраля) или она дальше чем на год от текущего.
 */
export function parseFormDate(v: string, now = new Date()): string | null {
  const m = ISO_RE.exec(v) ?? RU_RE.exec(v);
  if (!m) return null;
  const [y, mo, d] = ISO_RE.test(v) ? [m[1], m[2], m[3]] : [m[3], m[2], m[1]];
  const iso = `${y}-${mo}-${d}`;
  const t = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== iso) return null;
  if (Math.abs(Number(y) - now.getFullYear()) > 1) return null;
  return iso;
}

/** «гггг-мм-дд» → «дд.мм.гггг» для показа и полей формы. */
export function formatFormDate(iso: string): string {
  const m = ISO_RE.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

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
        // Только цифры: Number("0x2") === 2, Number("1e1") === 10 — такое не принимаем.
        const n = /^\d{1,3}$/.test(v) ? Number(v) : NaN;
        if (!Number.isInteger(n) || n < f.min || n > f.max) errors[f.name] = `Число от ${f.min} до ${f.max}`;
        break;
      }
      case "date": {
        const iso = parseFormDate(v);
        if (!iso) errors[f.name] = "Укажите дату в формате дд.мм.гггг";
        else {
          data[f.name] = iso;
          continue;
        }
        break;
      }
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
