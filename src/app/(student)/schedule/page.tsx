import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck2, CalendarPlus, ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { getMyLessons, type LessonView } from "@/server/dal/schedule";
import { PageHeader } from "@/components/app/page-header";
import { LessonCard } from "@/components/app/lesson-card";
import { EmptyState } from "@/components/app/empty-state";
import {
  addDays,
  formatDayMonth,
  formatShortWeekday,
  formatWeekday,
  mskDateKey,
  startOfMskDay,
  startOfMskWeek,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Расписание" };

type SP = Promise<{ view?: string; d?: string; w?: string }>;

export default async function SchedulePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const now = new Date();
  const view = sp.view === "week" ? "week" : "day";

  // Выбранный день (?d=YYYY-MM-DD) или сегодня; неделя (?w=смещение) — относительно текущей.
  const parsed = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? new Date(`${sp.d}T12:00:00+03:00`) : null;
  const day = startOfMskDay(parsed && !Number.isNaN(parsed.getTime()) ? parsed : now);
  const weekOffset = Math.max(-2, Math.min(6, Number.parseInt(sp.w ?? "0", 10) || 0));
  const weekStart = view === "week" ? addDays(startOfMskWeek(now), weekOffset * 7) : startOfMskWeek(day);
  const lessons = await getMyLessons(weekStart, addDays(weekStart, 7));

  const byDay = new Map<string, LessonView[]>();
  for (const l of lessons) {
    const k = mskDateKey(l.startsAt);
    byDay.set(k, [...(byDay.get(k) ?? []), l]);
  }
  const changes = lessons.filter((l) => l.status !== "normal");
  const todayKey = mskDateKey(now);
  const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));
  const curOffset = Math.round((weekStart.getTime() - startOfMskWeek(now).getTime()) / (7 * 86400000));

  return (
    <>
      <PageHeader title="Расписание" description={`Неделя ${formatDayMonth(weekStart)} — ${formatDayMonth(addDays(weekStart, 5))}`} />

      <div className="mb-4 grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-medium" role="tablist">
        <Link role="tab" aria-selected={view === "day"} href="/schedule" className={cn("rounded-lg py-2 text-center", view === "day" ? "bg-card shadow-sm" : "text-muted-foreground")}>
          День
        </Link>
        <Link role="tab" aria-selected={view === "week"} href="/schedule?view=week" className={cn("rounded-lg py-2 text-center", view === "week" ? "bg-card shadow-sm" : "text-muted-foreground")}>
          Неделя
        </Link>
      </div>

      {changes.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-warning/15 p-3 text-sm text-warning-foreground ring-1 ring-warning/50" data-testid="changes-summary">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">Изменения на этой неделе: {changes.length}.</span>{" "}
            {changes
              .slice(0, 3)
              .map((c) => `${c.disciplineShort} (${formatShortWeekday(c.startsAt)})`)
              .join(", ")}
          </p>
        </div>
      )}

      {view === "day" ? (
        <>
          <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1" aria-label="Дни недели">
            {days.map((d) => {
              const k = mskDateKey(d);
              const active = k === mskDateKey(day);
              const hasChange = (byDay.get(k) ?? []).some((l) => l.status !== "normal");
              return (
                <Link
                  key={k}
                  href={`/schedule?d=${k}`}
                  aria-current={active ? "date" : undefined}
                  className={cn(
                    "relative flex min-w-13 flex-1 flex-col items-center rounded-xl px-2 py-2 text-sm ring-1 ring-foreground/10",
                    active ? "bg-primary text-primary-foreground ring-primary" : "bg-card",
                    k === todayKey && !active && "ring-2 ring-primary/50",
                  )}
                >
                  <span className="text-[11px] uppercase opacity-80">{formatShortWeekday(d)}</span>
                  <span className="text-base font-semibold">{formatDayMonth(d).split(" ")[0]}</span>
                  {hasChange && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-warning" aria-label="есть изменения" />}
                </Link>
              );
            })}
          </div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold first-letter:uppercase">
              {mskDateKey(day) === todayKey ? "Сегодня, " : ""}
              {formatWeekday(day)}, {formatDayMonth(day)}
            </h2>
            <div className="flex gap-1">
              <Link href={`/schedule?d=${mskDateKey(addDays(day, -7))}`} className="grid size-9 place-items-center rounded-lg hover:bg-muted" aria-label="Неделя назад">
                <ChevronLeft className="size-4" />
              </Link>
              <Link href={`/schedule?d=${mskDateKey(addDays(day, 7))}`} className="grid size-9 place-items-center rounded-lg hover:bg-muted" aria-label="Неделя вперёд">
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </div>
          <DayList lessons={byDay.get(mskDateKey(day)) ?? []} now={now} />
        </>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <Link href={`/schedule?view=week&w=${curOffset - 1}`} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm hover:bg-muted">
              <ChevronLeft className="size-4" /> Пред.
            </Link>
            <span className="text-sm font-medium">{curOffset === 0 ? "Текущая неделя" : curOffset === 1 ? "Следующая неделя" : curOffset > 0 ? `Через ${curOffset} нед.` : `${-curOffset} нед. назад`}</span>
            <Link href={`/schedule?view=week&w=${curOffset + 1}`} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm hover:bg-muted">
              След. <ChevronRight className="size-4" />
            </Link>
          </div>
          <div className="space-y-6">
            {days.map((d) => {
              const k = mskDateKey(d);
              const list = byDay.get(k) ?? [];
              return (
                <section key={k} aria-label={formatWeekday(d)}>
                  <h2 className={cn("mb-2 text-sm font-semibold first-letter:uppercase", k === todayKey && "text-primary")}>
                    {formatWeekday(d)}, {formatDayMonth(d)} {k === todayKey && "· сегодня"}
                  </h2>
                  {list.length ? (
                    <div className="space-y-2">{list.map((l) => <LessonCard key={l.id} l={l} now={now} />)}</div>
                  ) : (
                    <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">Пар нет</p>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      <Link
        href="/schedule/calendar"
        className="mt-7 flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 hover:bg-muted/40"
        data-testid="calendar-teaser"
      >
        <CalendarPlus className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Расписание в календаре телефона</span>
          <span className="block text-sm text-muted-foreground">Переносы и отмены обновятся сами</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </>
  );
}

function DayList({ lessons, now }: { lessons: LessonView[]; now: Date }) {
  if (!lessons.length) {
    return <EmptyState icon={CalendarCheck2} title="В этот день пар нет" text="Можно выдохнуть или заглянуть в расписание на неделю." />;
  }
  return <div className="space-y-2">{lessons.map((l) => <LessonCard key={l.id} l={l} now={now} />)}</div>;
}
