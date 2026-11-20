import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarClock, RefreshCcw, TriangleAlert } from "lucide-react";
import type { LessonView } from "@/server/dal/schedule";
import { addDays, formatDayMonth, formatMonthYear, formatShortWeekday, formatTime, mskDateKey, startOfMskWeek } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const MONTH_MIN = -1;
export const MONTH_MAX = 2;

export type MonthExam = { id: string; at: Date; name: string; room: string | null; retake: boolean };

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const CHANGE_LABEL: Record<string, string> = { moved: "перенос", room_changed: "другая аудитория", cancelled: "отмена" };

/**
 * Месяц: сетка Пн–Вс. В клетке — число пар, метка изменений и экзамен/пересдача.
 * Клетка ведёт на этот день. Ниже — список того, что важно в месяце.
 */
export function MonthView({
  monthStart,
  offset,
  lessons,
  exams,
  now,
}: {
  monthStart: Date;
  offset: number;
  lessons: LessonView[];
  exams: MonthExam[];
  now: Date;
}) {
  const monthKey = mskDateKey(monthStart).slice(0, 7);
  const gridStart = startOfMskWeek(monthStart);
  const days: Date[] = [];
  for (let d = gridStart; ; d = addDays(d, 1)) {
    if (days.length % 7 === 0 && days.length > 0 && mskDateKey(d).slice(0, 7) !== monthKey) break;
    days.push(d);
  }
  const todayKey = mskDateKey(now);

  const lessonsBy = new Map<string, LessonView[]>();
  for (const l of lessons) {
    const k = mskDateKey(l.startsAt);
    lessonsBy.set(k, [...(lessonsBy.get(k) ?? []), l]);
  }
  const examsBy = new Map<string, MonthExam[]>();
  for (const e of exams) {
    const k = mskDateKey(e.at);
    examsBy.set(k, [...(examsBy.get(k) ?? []), e]);
  }

  const inMonth = (d: Date) => mskDateKey(d).slice(0, 7) === monthKey;
  const changes = lessons.filter((l) => l.status !== "normal" && mskDateKey(l.startsAt).slice(0, 7) === monthKey);
  const monthExams = exams.filter((e) => mskDateKey(e.at).slice(0, 7) === monthKey);
  const events = [
    ...changes.map((l) => ({ key: l.id, at: l.startsAt, kind: "change" as const, l })),
    ...monthExams.map((e) => ({ key: e.id, at: e.at, kind: "exam" as const, e })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <MonthNav offset={offset - 1} disabled={offset <= MONTH_MIN} label="Предыдущий месяц" dir="prev" />
        <h2 className="text-base font-semibold" data-testid="month-title">
          {formatMonthYear(monthStart)}
        </h2>
        <MonthNav offset={offset + 1} disabled={offset >= MONTH_MAX} label="Следующий месяц" dir="next" />
      </div>

      <div className="rounded-2xl bg-card p-2 ring-1 ring-foreground/10 md:p-3" data-testid="month-grid">
        <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-medium uppercase text-muted-foreground" aria-hidden>
          {WEEKDAYS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const k = mskDateKey(d);
            const list = lessonsBy.get(k) ?? [];
            const dayExams = examsBy.get(k) ?? [];
            const hasChange = list.some((l) => l.status !== "normal");
            const retake = dayExams.some((e) => e.retake);
            const exam = dayExams.length > 0;
            const isToday = k === todayKey;
            const outside = !inMonth(d);
            const past = k < todayKey;
            const label = [
              `${formatShortWeekday(d)}, ${formatDayMonth(d)}`,
              list.length ? `пар: ${list.length}` : "пар нет",
              hasChange ? "есть изменения" : "",
              exam ? (retake ? "пересдача" : "экзамен") : "",
            ]
              .filter(Boolean)
              .join(", ");
            return (
              <Link
                key={k}
                href={`/schedule?d=${k}`}
                aria-label={label}
                aria-current={isToday ? "date" : undefined}
                data-testid="month-day"
                data-has-change={hasChange || undefined}
                data-exam={exam ? (retake ? "retake" : "exam") : undefined}
                className={cn(
                  "press relative flex min-h-14 flex-col rounded-lg p-1.5 text-left ring-inset hover:bg-muted md:min-h-20 md:p-2",
                  outside && !exam && "opacity-40",
                  outside && exam && "opacity-80",
                  past && !outside && "text-muted-foreground",
                  exam && (retake ? "bg-destructive/10 ring-1 ring-destructive/40" : "bg-primary/10 ring-1 ring-primary/40"),
                  isToday && "ring-2 ring-primary",
                )}
              >
                <span className={cn("text-sm font-semibold tabular-nums", isToday && "text-primary")}>{Number(k.slice(8))}</span>
                {hasChange && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-warning" aria-hidden />}
                <span className="mt-auto flex flex-wrap items-center gap-0.5" aria-hidden>
                  {exam ? (
                    <span className={cn("truncate text-[10px] font-semibold md:text-xs", retake ? "text-destructive" : "text-primary")}>
                      <span className="md:hidden">{retake ? "пер." : "экз."}</span>
                      <span className="hidden md:inline">{retake ? "Пересдача" : "Экзамен"}</span>
                    </span>
                  ) : (
                    <>
                      {list.slice(0, 4).map((l) => (
                        <span key={l.id} className={cn("h-1 w-1.5 rounded-full md:w-2.5", l.status === "cancelled" ? "bg-destructive/60" : "bg-foreground/35")} />
                      ))}
                      {list.length > 0 && <span className="hidden pl-0.5 text-[11px] text-muted-foreground md:inline">{list.length}</span>}
                    </>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-2.5 rounded-full bg-foreground/35" aria-hidden /> пара
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-warning" aria-hidden /> изменения
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary/30 ring-1 ring-primary/50" aria-hidden /> экзамен
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-destructive/25 ring-1 ring-destructive/50" aria-hidden /> пересдача
        </span>
      </p>

      <h2 className="mb-2 mt-6 text-[15px] font-semibold">Что важно в этом месяце</h2>
      {events.length ? (
        <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10" data-testid="month-events">
          {events.map((ev) => (
            <li key={ev.key}>
              <Link href={`/schedule?d=${mskDateKey(ev.at)}`} className="press-soft flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                {ev.kind === "exam" ? (
                  ev.e.retake ? (
                    <RefreshCcw className="size-5 shrink-0 text-destructive" aria-hidden />
                  ) : (
                    <CalendarClock className="size-5 shrink-0 text-primary" aria-hidden />
                  )
                ) : (
                  <TriangleAlert className="size-5 shrink-0 text-warning-foreground dark:text-warning" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium leading-snug">
                    {ev.kind === "exam" ? `${ev.e.retake ? "Пересдача" : "Экзамен"}: ${ev.e.name}` : `${ev.l.discipline}: ${CHANGE_LABEL[ev.l.status] ?? "изменение"}`}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {formatShortWeekday(ev.at)}, {formatDayMonth(ev.at)}, {formatTime(ev.at)}
                    {ev.kind === "exam" ? (ev.e.room ? ` · ${ev.e.room}` : "") : ev.l.changeNote ? ` · ${ev.l.changeNote}` : ""}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">Ни переносов, ни экзаменов — обычный месяц.</p>
      )}
    </>
  );
}

function MonthNav({ offset, disabled, label, dir }: { offset: number; disabled: boolean; label: string; dir: "prev" | "next" }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  if (disabled) {
    return (
      <span className="grid size-9 place-items-center rounded-lg text-muted-foreground/40" aria-hidden>
        <Icon className="size-4" />
      </span>
    );
  }
  return (
    <Link href={`/schedule?view=month&m=${offset}`} className="press grid size-9 place-items-center rounded-lg hover:bg-muted" aria-label={label}>
      <Icon className="size-4" />
    </Link>
  );
}
