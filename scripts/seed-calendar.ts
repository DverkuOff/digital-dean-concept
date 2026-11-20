// Календарные правила сида: праздники, дни экзаменов, диапазон пар, правдоподобное время событий.
// Чистые функции без БД — тест scripts/seed-calendar.test.ts.
import { DAY_MS, addDays, mskDateKey, startOfMskDay, startOfMskMonth, startOfMskWeek } from "../src/lib/dates";

/**
 * Нерабочие праздничные дни РФ (ТК РФ, ст. 112): 1–8 января, 23 февраля, 8 марта, 1 и 9 мая, 12 июня, 4 ноября.
 * Плюс 31 декабря — в последние годы его делают выходным переносом, экзамен в этот день выглядит странно.
 */
const RU_HOLIDAYS = new Set([
  "01-01", "01-02", "01-03", "01-04", "01-05", "01-06", "01-07", "01-08",
  "02-23", "03-08", "05-01", "05-09", "06-12", "11-04", "12-31",
]);

export function isRuHoliday(d: Date): boolean {
  return RU_HOLIDAYS.has(mskDateKey(d).slice(5));
}

function weekday(d: Date): number {
  return new Date(`${mskDateKey(d)}T12:00:00Z`).getUTCDay(); // 0 = вс
}

/** Экзамены и пересдачи — не в воскресенье и не в праздник: сдвигаем на ближайший подходящий день. */
export function examDay(d: Date): Date {
  let x = d;
  while (weekday(x) === 0 || isRuHoliday(x)) x = addDays(x, 1);
  return x;
}

/**
 * Пары генерируем с недели, в которую попадает 1-е число прошлого месяца (вид «Месяц» листается на месяц назад),
 * но не раньше 1 сентября текущего учебного года.
 */
export function lessonRange(now: Date): { from: Date; notBefore: Date } {
  const [y, m] = mskDateKey(now).split("-").map(Number);
  const notBefore = new Date(`${m >= 9 ? y : y - 1}-09-01T00:00:00+03:00`);
  const prevMonth = startOfMskMonth(now, -1);
  const from = startOfMskWeek(prevMonth.getTime() > notBefore.getTime() ? prevMonth : notBefore);
  return { from, notBefore };
}

/** Детерминированное число 0…n-1 по строке (FNV-1a): без Math.random, одинаково при каждом сбросе. */
export function hashInt(key: string, n: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % Math.max(1, n);
}

export type Actor = "student" | "staff";
const MIN = 60_000;
// Студент пишет с 9 до 19, учебный офис работает пн–пт с 10 до 17.
const WINDOW: Record<Actor, [number, number]> = { student: [9 * 60, 19 * 60], staff: [10 * 60, 17 * 60] };

/**
 * Время шагов одной истории (заявка, уведомление): примерно «daysAgo дней назад», но в рабочие часы,
 * у методиста — в будни, строго по порядку, не в одну минуту и не позже now.
 * Идём с конца: последний шаг не позже now, каждый предыдущий — раньше следующего.
 */
export function eventTimes(now: Date, steps: { daysAgo: number; actor: Actor }[], salt: string): Date[] {
  const out: Date[] = new Array(steps.length);
  let limit = now.getTime() - 5 * MIN;
  for (let i = steps.length - 1; i >= 0; i--) {
    const { daysAgo, actor } = steps[i];
    const [ws, we] = WINDOW[actor];
    let day = startOfMskDay(new Date(now.getTime() - daysAgo * DAY_MS));
    let t = 0;
    for (let guard = 0; guard < 30; guard++) {
      if (actor === "staff" && [0, 6].includes(weekday(day))) {
        day = addDays(day, -1);
        continue;
      }
      const start = day.getTime() + ws * MIN;
      const end = day.getTime() + we * MIN;
      const want = start + hashInt(`${salt}:${i}:${guard}`, we - ws) * MIN;
      if (want <= limit) {
        t = want;
        break;
      }
      // Хотели позже, чем можно: берём время внутри окна этого дня до границы, если оно есть.
      const hi = Math.min(end, limit);
      if (hi - start >= 10 * MIN) {
        t = start + hashInt(`${salt}:${i}:fit`, Math.floor((hi - start) / MIN)) * MIN;
        break;
      }
      day = addDays(day, -1);
    }
    out[i] = new Date(t);
    // Следующий (более ранний) шаг — хотя бы на 20–90 минут раньше.
    limit = t - (20 + hashInt(`${salt}:${i}:gap`, 70)) * MIN;
  }
  return out;
}

/** Один момент «примерно daysAgo дней назад» в рабочие часы. */
export function eventAt(now: Date, daysAgo: number, actor: Actor, salt: string): Date {
  return eventTimes(now, [{ daysAgo, actor }], salt)[0];
}
