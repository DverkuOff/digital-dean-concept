// Время в прототипе — московское (UTC+3, без перехода на летнее время).
export const TZ = "Europe/Moscow";
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Полночь по Москве для даты d (как момент UTC). */
export function startOfMskDay(d: Date): Date {
  const shifted = new Date(d.getTime() + MSK_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - MSK_OFFSET_MS);
}

/** Понедельник 00:00 по Москве для недели, в которую попадает d. */
export function startOfMskWeek(d: Date): Date {
  const day = startOfMskDay(d);
  const weekday = new Date(day.getTime() + MSK_OFFSET_MS).getUTCDay(); // 0 = вс
  const diff = (weekday + 6) % 7;
  return new Date(day.getTime() - diff * DAY_MS);
}

/** Момент «день d по Москве, hh:mm». */
export function mskAt(day: Date, hh: number, mm = 0): Date {
  return new Date(startOfMskDay(day).getTime() + (hh * 60 + mm) * 60 * 1000);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

/** Сколько календарных дней (по Москве) от a до b. */
export function mskDayDiff(a: Date, b: Date): number {
  return Math.round((startOfMskDay(b).getTime() - startOfMskDay(a).getTime()) / DAY_MS);
}

/** Ключ дня по Москве: YYYY-MM-DD. */
export function mskDateKey(d: Date): string {
  const s = new Date(d.getTime() + MSK_OFFSET_MS);
  return s.toISOString().slice(0, 10);
}

const fmtTime = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const fmtDayMonth = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, day: "numeric", month: "long" });
const fmtWeekday = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, weekday: "long" });
const fmtShortWeekday = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, weekday: "short" });
const fmtDateTime = new Intl.DateTimeFormat("ru-RU", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});
const fmtDate = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });

export const formatTime = (d: Date) => fmtTime.format(d);
export const formatDayMonth = (d: Date) => fmtDayMonth.format(d);
export const formatWeekday = (d: Date) => fmtWeekday.format(d);
export const formatShortWeekday = (d: Date) => fmtShortWeekday.format(d);
export const formatDateTime = (d: Date) => fmtDateTime.format(d);
export const formatDate = (d: Date) => fmtDate.format(d);

/** «сегодня», «завтра», «через 3 дня», «вчера», «5 дней назад». */
export function relativeDay(target: Date, now = new Date()): string {
  const n = mskDayDiff(now, target);
  if (n === 0) return "сегодня";
  if (n === 1) return "завтра";
  if (n === 2) return "послезавтра";
  if (n === -1) return "вчера";
  if (n > 0) return `через ${n} ${plural(n, "день", "дня", "дней")}`;
  return `${-n} ${plural(-n, "день", "дня", "дней")} назад`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const fmtScore = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
/** Балл по-русски: 68,4. */
export const formatScore = (n: number | null | undefined) => (n === null || n === undefined ? "—" : fmtScore.format(n));

/** +n рабочих дней (пн–пт по Москве), праздники в концепте не учитываются. */
export function addBusinessDays(from: Date, n: number): Date {
  let d = from;
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    const wd = new Date(d.getTime() + MSK_OFFSET_MS).getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}
