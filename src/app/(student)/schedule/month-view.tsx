import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarClock, RefreshCcw, TriangleAlert } from "lucide-react";
import type { LessonView } from "@/server/dal/schedule";
import { addDays, formatDayMonth, formatMonthYear, formatShortWeekday, formatTime, mskDateKey, startOfMskWeek } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { MONTH_MAX, MONTH_MIN } from "@/lib/schedule/nav";
import type { ExamView } from "@/components/app/exam-card";

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
  exams: ExamView[];
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
  const examsBy = new Map<string, ExamView[]>();
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
        <div className="grid grid-cols-7 gap-y-1">
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
            // Точки под числом, как в календаре iOS: изменение — оранжевая первой, затем пары (не больше трёх точек).
            const dots: string[] = [];
            if (hasChange) dots.push(list.some((l) => l.status === "cancelled") ? "bg-destructive" : "bg-warning");
            for (let i = 0; i < Math.min(list.length, 3) && dots.length < 3; i++) dots.push("bg-foreground/30");
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
                  "press-soft group flex h-14 flex-col items-center gap-1 rounded-xl pt-1 md:h-20 md:pt-2 [@media(hover:hover)]:hover:bg-muted",
                  outside && !exam && "opacity-40",
                  outside && exam && "opacity-80",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-full text-[15px] tabular-nums md:size-9",
                    past && !outside && !isToday && "text-muted-foreground",
                    exam && !isToday && (retake ? "bg-destructive/12 font-semibold text-destructive ring-1 ring-inset ring-destructive/45 dark:bg-destructive/25 dark:ring-destructive/70" : "bg-primary/12 font-semibold text-primary ring-1 ring-inset ring-primary/45 dark:bg-primary/25 dark:ring-primary/70"),
                    isToday && "bg-primary font-semibold text-primary-foreground",
                  )}
                >
                  {Number(k.slice(8))}
                </span>
                {exam ? (
                  <span className={cn("text-[10px] font-semibold leading-none md:text-xs", retake ? "text-destructive" : "text-primary")} aria-hidden>
                    <span className="md:hidden">{retake ? "пересд." : "экз."}</span>
                    <span className="hidden md:inline">{retake ? "Пересдача" : "Экзамен"}</span>
                  </span>
                ) : (
                  <span className="flex h-1.5 items-center gap-[3px]" aria-hidden>
                    {dots.map((c, i) => (
                      <span key={i} className={cn("size-[5px] rounded-full", c)} />
                    ))}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-[5px] rounded-full bg-foreground/30" aria-hidden /> пара
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-[5px] rounded-full bg-warning" aria-hidden /> изменение
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-primary/12 ring-1 ring-inset ring-primary/45 dark:bg-primary/25 dark:ring-primary/70" aria-hidden /> экзамен
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-destructive/12 ring-1 ring-inset ring-destructive/45 dark:bg-destructive/25 dark:ring-destructive/70" aria-hidden /> пересдача
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-primary" aria-hidden /> сегодня
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
                    {formatShortWeekday(ev.at)}, {formatDayMonth(ev.at)}, {ev.kind === "exam" ? formatTime(ev.at) : changeWhat(ev.l)}
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

/** Что изменилось: перенос — «10:40 → 16:00», аудитория — «14:20, ауд. 420 → 2210», отмена — время. */
function changeWhat(l: LessonView): string {
  if (l.status === "moved" && l.originalStartsAt) return `${formatTime(l.originalStartsAt)} → ${formatTime(l.startsAt)}`;
  if (l.status === "room_changed" && l.originalRoom) {
    const to = l.originalRoom.startsWith("ауд. ") && l.room.startsWith("ауд. ") ? l.room.slice(5) : l.room;
    return `${formatTime(l.startsAt)}, ${l.originalRoom} → ${to}`;
  }
  return formatTime(l.startsAt);
}

function MonthNav({ offset, disabled, label, dir }: { offset: number; disabled: boolean; label: string; dir: "prev" | "next" }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  if (disabled) {
    return (
      <span className="grid size-10 place-items-center rounded-lg text-muted-foreground/40" aria-hidden>
        <Icon className="size-4" />
      </span>
    );
  }
  return (
    <Link href={`/schedule?view=month&m=${offset}`} className="press grid size-10 place-items-center rounded-lg hover:bg-muted" aria-label={label}>
      <Icon className="size-4" />
    </Link>
  );
}
