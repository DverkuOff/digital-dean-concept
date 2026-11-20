import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck2, CalendarPlus, ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { getMyLessons, type LessonView } from "@/server/dal/schedule";
import { getMyAttempts, getMyGrades } from "@/server/dal/grades";
import { MonthView } from "./month-view";
import { PageHeader } from "@/components/app/page-header";
import { LessonCard } from "@/components/app/lesson-card";
import { ExamCard, examLabel, type ExamView } from "@/components/app/exam-card";
import { EmptyState } from "@/components/app/empty-state";
import { SegmentedTabs } from "@/components/app/segmented-tabs";
import { addDays, formatDayMonth, formatDayRange, formatShortWeekday, formatWeekday, mskDateKey, startOfMskMonth, startOfMskWeek } from "@/lib/dates";
import { changesTitle, parseSchedule, scheduleTabs } from "@/lib/schedule/nav";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Расписание" };

type SP = Promise<{ view?: string; d?: string; w?: string; m?: string }>;

export default async function SchedulePage({ searchParams }: { searchParams: SP }) {
  const now = new Date();
  // Выбранный день (?d=), неделя (?w=) и месяц (?m=) — смещения от текущих, крайние значения зажаты (nav.ts).
  const st = parseSchedule(await searchParams, now);
  const { view, day, weekStart, monthStart } = st;
  const tabs = scheduleTabs(st, now);
  const monthGridStart = startOfMskWeek(monthStart);
  const monthGridEnd = addDays(startOfMskWeek(startOfMskMonth(monthStart, 1)), 7);
  const [lessons, attempts, grades] = await Promise.all([
    view === "month" ? getMyLessons(monthGridStart, monthGridEnd) : getMyLessons(weekStart, addDays(weekStart, 7)),
    getMyAttempts(),
    getMyGrades(),
  ]);

  // Экзамены и пересдачи — во всех видах: в день экзамена не должно быть «пар нет, можно выдохнуть».
  const nameOf = (id: string) => grades.find((g) => g.disciplineId === id)?.name ?? "экзамен";
  const exams: ExamView[] = attempts
    .filter((a) => a.result === "scheduled" && a.scheduledAt)
    .map((a) => ({ id: a.id, at: a.scheduledAt!, name: nameOf(a.disciplineId), room: a.room, retake: a.kind !== "main", label: examLabel(a.kind) }));
  const examsBy = new Map<string, ExamView[]>();
  for (const e of exams) examsBy.set(mskDateKey(e.at), [...(examsBy.get(mskDateKey(e.at)) ?? []), e]);

  const byDay = new Map<string, LessonView[]>();
  for (const l of lessons) {
    const k = mskDateKey(l.startsAt);
    byDay.set(k, [...(byDay.get(k) ?? []), l]);
  }
  const changes = view === "month" ? [] : lessons.filter((l) => l.status !== "normal");
  const todayKey = mskDateKey(now);
  const dayKey = mskDateKey(day);
  // Пн–Сб; воскресенье — только если его выбрали (клик по клетке месяца).
  const days = Array.from({ length: view === "day" && formatShortWeekday(day) === "вс" ? 7 : 6 }, (_, i) => addDays(weekStart, i));
  const curOffset = st.weekOffset;

  return (
    <>
      <PageHeader title="Расписание" description={view === "month" ? "Месяц: пары, изменения и сессия" : formatDayRange(weekStart, addDays(weekStart, 5))} />

      <SegmentedTabs
        label="Вид расписания"
        active={view}
        items={[
          { key: "day", href: tabs.day, label: "День" },
          { key: "week", href: tabs.week, label: "Неделя" },
          { key: "month", href: tabs.month, label: "Месяц" },
        ]}
      />

      {changes.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-warning/15 p-3 text-sm text-warning-foreground ring-1 ring-warning/50" data-testid="changes-summary">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">
              Изменения {changesTitle(weekStart, now)}: {changes.length}.
            </span>{" "}
            {changes
              .slice(0, 3)
              .map((c) => `${c.discipline}, ${formatShortWeekday(c.startsAt)}`)
              .join("; ")}
            {changes.length > 3 && ` и ещё ${changes.length - 3}`}
          </p>
        </div>
      )}

      {view === "month" ? (
        <MonthView monthStart={monthStart} offset={st.monthOffset} lessons={lessons} exams={exams} now={now} />
      ) : view === "day" ? (
        <>
          <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 py-1" aria-label="Дни недели">
            {days.map((d) => {
              const k = mskDateKey(d);
              const active = k === dayKey;
              const hasChange = (byDay.get(k) ?? []).some((l) => l.status !== "normal");
              const dayExams = examsBy.get(k) ?? [];
              return (
                <Link
                  key={k}
                  href={`/schedule?d=${k}`}
                  aria-current={active ? "date" : undefined}
                  className={cn(
                    "press relative flex min-w-10 flex-1 flex-col items-center rounded-xl px-1 py-2 text-sm ring-1 ring-foreground/10 ring-inset",
                    active ? "bg-primary text-primary-foreground ring-primary" : "bg-card hover:bg-muted",
                    k === todayKey && !active && "ring-2 ring-primary/60",
                  )}
                >
                  <span className="text-[11px] uppercase opacity-80">{formatShortWeekday(d)}</span>
                  <span className="text-base font-semibold">{formatDayMonth(d).split(" ")[0]}</span>
                  {hasChange && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-warning" aria-label="есть изменения" />}
                  {dayExams.length > 0 && (
                    <span
                      className={cn(
                        "absolute bottom-1 left-1/2 h-1 w-4 -translate-x-1/2 rounded-full",
                        dayExams.some((e) => e.retake) ? "bg-destructive" : "bg-primary",
                        active && "bg-primary-foreground",
                      )}
                      aria-label={dayExams.some((e) => e.retake) ? "пересдача" : "экзамен"}
                    />
                  )}
                </Link>
              );
            })}
          </div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold first-letter:uppercase">
              {dayKey === todayKey ? "Сегодня, " : ""}
              {formatWeekday(day)}, {formatDayMonth(day)}
            </h2>
            <div className="flex gap-1">
              <Link href={`/schedule?d=${mskDateKey(addDays(day, -7))}`} className="grid size-10 place-items-center rounded-lg hover:bg-muted" aria-label="Неделя назад">
                <ChevronLeft className="size-4" />
              </Link>
              <Link href={`/schedule?d=${mskDateKey(addDays(day, 7))}`} className="grid size-10 place-items-center rounded-lg hover:bg-muted" aria-label="Неделя вперёд">
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </div>
          <DayList lessons={byDay.get(dayKey) ?? []} exams={examsBy.get(dayKey) ?? []} now={now} />
        </>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <Link href={`/schedule?view=week&w=${curOffset - 1}`} className="inline-flex h-10 items-center gap-1 rounded-lg px-2 text-sm hover:bg-muted">
              <ChevronLeft className="size-4" /> Пред.
            </Link>
            <span className="text-sm font-medium">{curOffset === 0 ? "Текущая неделя" : curOffset === 1 ? "Следующая неделя" : curOffset > 0 ? `Через ${curOffset} нед.` : `${-curOffset} нед. назад`}</span>
            <Link href={`/schedule?view=week&w=${curOffset + 1}`} className="inline-flex h-10 items-center gap-1 rounded-lg px-2 text-sm hover:bg-muted">
              След. <ChevronRight className="size-4" />
            </Link>
          </div>
          <div className="space-y-6">
            {days.map((d) => {
              const k = mskDateKey(d);
              const list = byDay.get(k) ?? [];
              const dayExams = examsBy.get(k) ?? [];
              return (
                <section key={k} aria-label={formatWeekday(d)}>
                  <h2 className={cn("mb-2 text-sm font-semibold first-letter:uppercase", k === todayKey && "text-primary")}>
                    {formatWeekday(d)}, {formatDayMonth(d)} {k === todayKey && "· сегодня"}
                  </h2>
                  {list.length || dayExams.length ? (
                    <div className="space-y-2">
                      {dayExams.map((e) => <ExamCard key={e.id} e={e} />)}
                      {list.map((l) => <LessonCard key={l.id} l={l} now={now} />)}
                    </div>
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
        className="press-soft mt-7 flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 hover:bg-muted/40"
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

function DayList({ lessons, exams, now }: { lessons: LessonView[]; exams: ExamView[]; now: Date }) {
  if (!lessons.length && !exams.length) {
    return <EmptyState icon={CalendarCheck2} title="В этот день пар нет" text="Можно выдохнуть или заглянуть в расписание на неделю." />;
  }
  return (
    <div className="space-y-2">
      {exams.map((e) => <ExamCard key={e.id} e={e} />)}
      {lessons.map((l) => <LessonCard key={l.id} l={l} now={now} />)}
      {exams.length > 0 && !lessons.length && (
        <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Пар в этот день нет — только {exams.some((e) => e.retake) ? "пересдача" : "экзамен"}. Удачи!
        </p>
      )}
    </div>
  );
}
