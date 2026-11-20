// Параметры экрана «Расписание» (?view, ?d, ?w, ?m) и ссылки вкладок. Чистые функции, тест — nav.test.ts.
import { DAY_MS, addDays, formatDayRange, mskDateKey, startOfMskDay, startOfMskMonth, startOfMskWeek } from "@/lib/dates";

export const MONTH_MIN = -1;
export const MONTH_MAX = 2;
const WEEK_LIMIT = 52;
const DAY_LIMIT = 365;

export type ScheduleView = "day" | "week" | "month";
export type ScheduleState = {
  view: ScheduleView;
  /** Выбранный день (вид «День»). */
  day: Date;
  /** Понедельник показанной недели (вид «День» и «Неделя»). */
  weekStart: Date;
  weekOffset: number;
  monthOffset: number;
  monthStart: Date;
  /** В адресе был день (?d=). */
  hasDay: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const int = (v: string | undefined) => Number.parseInt(v ?? "0", 10) || 0;

function weeksBetween(a: Date, b: Date) {
  return Math.round((startOfMskWeek(b).getTime() - startOfMskWeek(a).getTime()) / (7 * DAY_MS));
}
function monthsBetween(a: Date, b: Date) {
  const [ya, ma] = mskDateKey(a).split("-").map(Number);
  const [yb, mb] = mskDateKey(b).split("-").map(Number);
  return yb * 12 + mb - (ya * 12 + ma);
}

export function parseSchedule(sp: { view?: string; d?: string; w?: string; m?: string }, now: Date): ScheduleState {
  const view: ScheduleView = sp.view === "week" ? "week" : sp.view === "month" ? "month" : "day";
  const today = startOfMskDay(now);
  // ?d=YYYY-MM-DD; несуществующая дата — сегодня, слишком далёкая — не дальше года от сегодня.
  let day = today;
  let hasDay = false;
  if (sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d)) {
    const t = new Date(`${sp.d}T12:00:00+03:00`);
    if (!Number.isNaN(t.getTime()) && mskDateKey(t) === sp.d) {
      const lo = addDays(today, -DAY_LIMIT).getTime();
      const hi = addDays(today, DAY_LIMIT).getTime();
      day = startOfMskDay(new Date(clamp(t.getTime(), lo, hi)));
      hasDay = true;
    }
  }
  const weekOffset = view === "week" ? clamp(int(sp.w), -WEEK_LIMIT, WEEK_LIMIT) : weeksBetween(now, day);
  const weekStart = addDays(startOfMskWeek(now), weekOffset * 7);
  const monthOffset = clamp(int(sp.m), MONTH_MIN, MONTH_MAX);
  return { view, day, weekStart, weekOffset, monthOffset, monthStart: startOfMskMonth(now, monthOffset), hasDay };
}

/** Ссылки вкладок: «Неделя» и «Месяц» — той недели/месяца, что сейчас на экране; «День» — сегодня, если он внутри, иначе первый день. */
export function scheduleTabs(s: ScheduleState, now: Date): { day: string; week: string; month: string } {
  const todayKey = mskDateKey(now);
  const dayHref = (d: Date) => (mskDateKey(d) === todayKey ? "/schedule" : `/schedule?d=${mskDateKey(d)}`);
  const monthHref = (d: Date) => `/schedule?view=month&m=${clamp(monthsBetween(now, d), MONTH_MIN, MONTH_MAX)}`;
  const weekHref = (d: Date) => `/schedule?view=week&w=${clamp(weeksBetween(now, d), -WEEK_LIMIT, WEEK_LIMIT)}`;
  if (s.view === "day") return { day: dayHref(s.day), week: weekHref(s.day), month: monthHref(s.day) };
  if (s.view === "week") {
    const inWeek = s.weekOffset === 0;
    return { day: inWeek ? "/schedule" : dayHref(s.weekStart), week: weekHref(s.weekStart), month: monthHref(inWeek ? now : s.weekStart) };
  }
  const inMonth = s.monthOffset === 0;
  const anchor = inMonth ? now : s.monthStart;
  return { day: dayHref(anchor), week: weekHref(anchor), month: monthHref(s.monthStart) };
}

/** «на этой неделе», «на следующей неделе», «на неделе 7–12 декабря». */
export function changesTitle(weekStart: Date, now: Date): string {
  const off = weeksBetween(now, weekStart);
  if (off === 0) return "на этой неделе";
  if (off === 1) return "на следующей неделе";
  if (off === -1) return "на прошлой неделе";
  return `на неделе ${formatDayRange(weekStart, addDays(weekStart, 5))}`;
}
