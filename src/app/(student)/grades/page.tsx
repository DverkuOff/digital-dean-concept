import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, CircleCheck, CircleAlert, Compass } from "lucide-react";
import { getMyAttempts, getMyGrades, toResults, type GradeView } from "@/server/dal/grades";
import { PageHeader, SectionTitle } from "@/components/app/page-header";
import { calcRating, gradeBand } from "@/lib/rating/calc";
import { RATING_CONFIG } from "@/lib/rating/config";
import { formatDayMonth, formatScore, formatShortWeekday, formatTime, relativeDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Учёба" };

const CONTROL = { exam: "экзамен", diff_credit: "дифзачёт", credit: "зачёт" } as const;

export default async function GradesPage() {
  const [grades, attempts] = await Promise.all([getMyGrades(), getMyAttempts()]);
  const now = new Date();
  const results = toResults(grades);
  const rating = calcRating(results, RATING_CONFIG);
  const debts = grades.filter((g) => g.status === "debt");
  const open = grades.filter((g) => g.status === "open");
  const currentSemester = Math.max(...grades.map((g) => g.semester));
  const closedSemesters = [...new Set(grades.filter((g) => g.semester < currentSemester).map((g) => g.semester))].sort((a, b) => b - a);
  const session = attempts.filter((a) => a.kind === "main" && a.result === "scheduled" && a.scheduledAt && a.scheduledAt > now);
  const retakes = attempts.filter((a) => a.kind !== "main" && a.result === "scheduled" && a.scheduledAt && a.scheduledAt > now);
  // Пересдача уже прошла, а результат не внесён — не выдаём её за будущую.
  const pendingRetake = attempts.find((a) => a.kind !== "main" && a.result === "scheduled" && a.scheduledAt && a.scheduledAt <= now);
  const nameOf = (id: string) => grades.find((g) => g.disciplineId === id)?.name ?? "";

  const sliceAvg = (g: GradeView) => {
    const s = [g.slice1, g.slice2, g.slice3].filter((x): x is number => x !== null);
    return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
  };
  const weakOpen = open.filter((g) => (sliceAvg(g) ?? 100) < 65);

  return (
    <>
      <PageHeader title="Учёба" description={`${currentSemester}-й семестр · текущий контроль и сессия`} />

      {/* «Как у меня дела» одной карточкой */}
      <section
        data-testid="how-am-i"
        className={cn(
          "rounded-2xl p-5 ring-1",
          debts.length ? "bg-destructive/5 ring-destructive/25" : "bg-success/10 ring-success/30",
        )}
      >
        <div className="flex items-start gap-3">
          {debts.length ? (
            <CircleAlert className="mt-0.5 size-6 shrink-0 text-destructive" aria-hidden />
          ) : (
            <CircleCheck className="mt-0.5 size-6 shrink-0 text-success" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-snug">
              {debts.length
                ? `Есть долг: ${debts.map((d) => d.name).join(", ")}`
                : "Все прошлые сессии закрыты без долгов"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Рейтинг <b className="text-foreground">{formatScore(rating.rating)}</b> из 100.{" "}
              {pendingRetake?.scheduledAt
                ? `Пересдача прошла ${formatDayMonth(pendingRetake.scheduledAt)}, результат ещё не внесён.`
                : retakes.length > 0 && retakes[0].scheduledAt
                ? `Пересдача ${relativeDay(retakes[0].scheduledAt, now)}, ${formatDayMonth(retakes[0].scheduledAt)}.`
                : weakOpen.length
                  ? `В этом семестре стоит подтянуть: ${weakOpen.map((g) => g.shortName).join(", ")}.`
                  : "В текущем семестре по срезам всё идёт хорошо."}
            </p>
          </div>
        </div>
        <Link
          href="/rating"
          className="mt-4 flex items-center justify-between rounded-xl bg-card px-4 py-3 text-sm font-medium ring-1 ring-foreground/10 hover:bg-muted/50"
        >
          <span className="flex items-center gap-2">
            <Compass className="size-4 text-primary" aria-hidden />
            {debts.length ? "Рейтинг и план пересдачи" : "Рейтинг-навигатор: что будет, если…"}
          </span>
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>

      <SectionTitle>Текущий семестр: срезы</SectionTitle>
      <div className="space-y-2">
        {open.map((g) => {
          const avg = sliceAvg(g);
          return (
            <div key={g.gradeId} className="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{g.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {CONTROL[g.controlType]} · {g.credits} ЗЕТ · {g.teacher}
                  </p>
                </div>
                {avg !== null && (
                  <span className={cn("shrink-0 rounded-lg px-2 py-1 text-sm font-semibold tabular-nums", avg < 60 ? "bg-destructive/10 text-destructive" : avg < 75 ? "bg-warning/20 text-warning-foreground" : "bg-success/15 text-success-foreground")}>
                    {avg}
                  </span>
                )}
              </div>
              {g.controlType !== "credit" ? (
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {[g.slice1, g.slice2, g.slice3].map((s, i) => (
                    <div key={i} className="rounded-lg bg-muted/60 px-2 py-1.5 text-center">
                      <p className="text-[11px] text-muted-foreground">Срез {i + 1}</p>
                      <p className="text-sm font-semibold tabular-nums">{s ?? "—"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Зачёт по посещаемости и нормативам</p>
              )}
            </div>
          );
        })}
      </div>

      <SectionTitle>Зимняя сессия</SectionTitle>
      {session.length ? (
        <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
          {session.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <CalendarClock className="size-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">{nameOf(a.disciplineId)}</p>
                <p className="text-sm text-muted-foreground">
                  {formatShortWeekday(a.scheduledAt!)}, {formatDayMonth(a.scheduledAt!)}, {formatTime(a.scheduledAt!)} · {a.room}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{relativeDay(a.scheduledAt!, now)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">Расписание сессии ещё не опубликовано</p>
      )}

      {/* Прошлые семестры свёрнуты; если там долг — раскрыты сразу. */}
      <details className="group mt-7" open={debts.length > 0}>
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl py-1 text-[15px] font-semibold">
          Прошлые семестры: итоги
          <span className="text-sm font-normal text-primary group-open:hidden">показать</span>
          <span className="hidden text-sm font-normal text-primary group-open:inline">свернуть</span>
        </summary>
      {closedSemesters.map((sem) => (
        <div key={sem}>
          <h3 className="mb-2 mt-4 text-sm font-medium text-muted-foreground">{sem}-й семестр</h3>
          <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
            {grades
              .filter((g) => g.semester === sem)
              .map((g) => (
                <li key={g.gradeId} className={cn("flex items-center gap-3 px-4 py-3", g.status === "debt" && "bg-destructive/5")} data-testid={g.status === "debt" ? "debt-row" : undefined}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{g.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {CONTROL[g.controlType]} · {g.credits} ЗЕТ
                    </p>
                  </div>
                  <FinalBadge g={g} />
                </li>
              ))}
          </ul>
        </div>
      ))}
      </details>
      <p className="mt-6 text-xs text-muted-foreground">
        Перевод баллов в оценки — условные правила концепта (90+ «отлично», 75+ «хорошо», 60+ «удовлетворительно»), вуз
        настраивает их в конфиге.
      </p>
    </>
  );
}

function FinalBadge({ g }: { g: GradeView }) {
  if (g.status === "debt") {
    return (
      <span className="shrink-0 rounded-lg bg-destructive px-2 py-1 text-sm font-semibold text-white">
        долг · {g.finalScore}
      </span>
    );
  }
  if (g.controlType === "credit" || g.finalScore === null) {
    return <span className="shrink-0 rounded-lg bg-success/15 px-2 py-1 text-sm font-medium text-success-foreground">зачтено</span>;
  }
  const band = gradeBand(g.finalScore, RATING_CONFIG);
  return (
    <span className="shrink-0 text-right">
      <span className="block text-base font-semibold tabular-nums">{g.finalScore}</span>
      <span className="block text-[11px] text-muted-foreground">{band.label}</span>
    </span>
  );
}
