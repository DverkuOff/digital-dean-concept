"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, CircleHelp, Loader2, Lock, MessagesSquare, RefreshCcw, Settings2, X } from "lucide-react";
import {
  calcRating,
  estimatePlace,
  evaluateThresholds,
  type CohortSummary,
  requiredAverageForTarget,
  round1,
  type DisciplineResult,
  type Hypothesis,
} from "@/lib/rating/calc";
import { RATING_CONFIG } from "@/lib/rating/config";
import { formatDayMonth, formatScore, formatTime, relativeDay } from "@/lib/dates";
import { quickRetakeRequestAction } from "@/server/actions/requests";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type OpenInfo = { disciplineId: string; name: string; credits: number; predicted: number };
export type DebtInfo = {
  disciplineId: string;
  name: string;
  credits: number;
  lastScore: number;
  ladder: { kind: string; label: string; result: string | null; score: number | null; at: string | null; room: string | null }[];
};

type Place = { place: number; total: number; topPercent: number };
type Props = { results: DisciplineResult[]; open: OpenInfo[]; debts: DebtInfo[]; cohort: CohortSummary | null; placeNow: Place | null; nowIso: string };

const SCALE_MIN = 50;
const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - SCALE_MIN) / (100 - SCALE_MIN)) * 100))}%`;

export function RatingNavigator({ results, open, debts, cohort, placeNow, nowIso }: Props) {
  const now = new Date(nowIso);
  const cfg = RATING_CONFIG;
  const [debtHyp, setDebtHyp] = useState<Hypothesis>(() => Object.fromEntries(debts.map((d) => [d.disciplineId, d.lastScore])));
  const [withSession, setWithSession] = useState(debts.length === 0);
  const [sessionHyp, setSessionHyp] = useState<Hypothesis>(() => Object.fromEntries(open.map((o) => [o.disciplineId, o.predicted])));

  const current = useMemo(() => calcRating(results, cfg), [results, cfg]);
  const hyp = useMemo<Hypothesis>(() => {
    const h: Hypothesis = {};
    for (const d of debts) if (debtHyp[d.disciplineId] !== d.lastScore) h[d.disciplineId] = debtHyp[d.disciplineId];
    if (withSession) Object.assign(h, sessionHyp);
    return h;
  }, [debts, debtHyp, withSession, sessionHyp]);
  const touched = Object.keys(hyp).length > 0;
  const projected = useMemo(() => calcRating(results, cfg, hyp), [results, cfg, hyp]);
  const shown = touched ? projected : current;
  const thresholds = evaluateThresholds(shown, cfg);
  const thresholdsNow = evaluateThresholds(current, cfg);
  // «Сейчас» — точное место с сервера; «что если» — оценка по гистограмме (обе стороны сравнения одинаково).
  const estNow = estimatePlace(current.rating, cohort);
  const estShown = estimatePlace(shown.rating, cohort);
  const placeShown = touched ? estShown : placeNow;
  const delta = touched && current.rating !== null && projected.rating !== null ? round1(projected.rating - current.rating) : 0;
  const placeDelta = touched && estNow && estShown ? estNow.place - estShown.place : 0;

  // Подсказка «сколько нужно»: ближайший недостигнутый порог при текущих долгах.
  const debtFixed: Hypothesis = {};
  for (const d of debts) if (debtHyp[d.disciplineId] !== d.lastScore) debtFixed[d.disciplineId] = debtHyp[d.disciplineId];
  const nextGoal = thresholds.find((t) => !t.reached && !t.blockedByDebt) ?? thresholds.find((t) => !t.reached);
  const need = nextGoal ? requiredAverageForTarget(results, cfg, nextGoal.min, debtFixed) : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight">Рейтинг-навигатор</h1>
        <p className="mt-1 text-sm text-muted-foreground">Что откроет мой рейтинг — и что будет, если сдам на N</p>
      </div>

      {/* Индикатор */}
      <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10" aria-label="Мой рейтинг" data-testid="rating-gauge">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{touched ? "Прогноз рейтинга" : "Рейтинг сейчас"}</p>
            <p className="flex items-baseline gap-2">
              <span className="text-5xl font-semibold tabular-nums tracking-tight" data-testid="rating-value">
                {formatScore(shown.rating)}
              </span>
              <span className="text-muted-foreground">/ 100</span>
            </p>
            {touched && (
              <p className={cn("mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium", delta >= 0 ? "bg-success/15 text-success-foreground" : "bg-destructive/10 text-destructive")} data-testid="rating-delta">
                {delta >= 0 ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />}
                {delta >= 0 ? "+" : "−"}
                {formatScore(Math.abs(delta))} к текущему {formatScore(current.rating)}
              </p>
            )}
          </div>
          {placeShown && (
            <div className="text-right" data-testid="cohort-place">
              <p className="text-sm text-muted-foreground">Место на курсе</p>
              <p className="text-2xl font-semibold tabular-nums">
                {touched && "≈ "}
                {placeShown.place}
                <span className="text-base font-normal text-muted-foreground"> из {placeShown.total}</span>
              </p>
              {touched && placeDelta !== 0 ? (
                <p className={cn("text-sm font-medium", placeDelta > 0 ? "text-success-foreground" : "text-destructive")}>
                  {placeDelta > 0 ? `↑ примерно на ${placeDelta}` : `↓ примерно на ${-placeDelta}`}
                </p>
              ) : placeShown.topPercent <= 50 ? (
                <p className="text-sm text-muted-foreground">в верхних {placeShown.topPercent}% курса</p>
              ) : null}
            </div>
          )}
        </div>

        {/* Шкала с порогами */}
        <div className="relative mt-6 mb-9" aria-hidden>
          <div className="h-3 rounded-full bg-gradient-to-r from-destructive/30 via-warning/40 to-success/40" />
          {cfg.thresholds.map((t) => (
            <div key={t.id} className="absolute -top-1 h-5 w-0.5 rounded bg-foreground/60" style={{ left: pos(t.min) }}>
              <span className="absolute top-6 -translate-x-1/2 text-[10px] font-medium tabular-nums text-muted-foreground">{t.min}</span>
            </div>
          ))}
          {touched && current.rating !== null && (
            <div className="absolute -top-1.5 size-6 -translate-x-1/2 rounded-full border-2 border-dashed border-foreground/40 bg-card" style={{ left: pos(current.rating) }} />
          )}
          {shown.rating !== null && (
            <div className="absolute -top-1.5 size-6 -translate-x-1/2 rounded-full border-4 border-card bg-primary shadow transition-[left] duration-300" style={{ left: pos(shown.rating) }} />
          )}
        </div>

        <p className="flex items-start gap-1.5 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <Settings2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Пороги и формула — условные правила концепта, вуз настраивает их в конфиге.{" "}
          {cohort
            ? `Место — среди ${cohort.n} однокурсников; их оценки и рейтинги вам не передаются, в режиме «что если» место примерное.`
            : "Место на курсе не показываем: в выборке меньше 10 человек, по нему можно было бы вычислить чужие оценки."}
        </p>
      </section>

      {/* Пороги */}
      <section aria-labelledby="thr">
        <h2 id="thr" className="mb-2 text-[15px] font-semibold">Что открывает рейтинг</h2>
        <ul className="divide-y rounded-2xl bg-card ring-1 ring-foreground/10" data-testid="thresholds">
          {thresholds.map((t) => {
            const was = thresholdsNow.find((x) => x.id === t.id)?.reached;
            const changed = touched && was !== t.reached;
            return (
              <li key={t.id} className={cn("flex items-center gap-3 px-4 py-3", changed && t.reached && "bg-success/10")} data-reached={t.reached}>
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", t.reached ? "bg-success text-white" : t.blockedByDebt ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
                  {t.reached ? <Check className="size-4" aria-hidden /> : t.blockedByDebt ? <X className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">
                    {t.label} <span className="text-sm font-normal text-muted-foreground">· от {t.min}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                </div>
                <span className={cn("shrink-0 text-right text-sm font-medium", t.reached ? "text-success-foreground" : t.blockedByDebt ? "text-destructive" : "text-muted-foreground")}>
                  {t.reached ? (changed ? "откроется!" : "проходите") : t.blockedByDebt && t.gap === 0 ? "мешает долг" : `−${formatScore(t.gap)}`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Режим пересдачи */}
      {debts.map((d) => (
        <RetakeBlock
          key={d.disciplineId}
          d={d}
          now={now}
          value={debtHyp[d.disciplineId]}
          onChange={(v) => setDebtHyp((h) => ({ ...h, [d.disciplineId]: v }))}
        />
      ))}

      {/* Что если: сессия */}
      {open.length > 0 && (
        <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10" aria-labelledby="ses">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="ses" className="text-[15px] font-semibold">Что если: зимняя сессия</h2>
              <p className="text-sm text-muted-foreground">Ползунки стоят на среднем по срезам</p>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={withSession} onChange={(e) => setWithSession(e.target.checked)} />
              учесть
            </label>
          </div>
          {withSession && (
            <div className="mt-4 space-y-5">
              {open.map((o) => (
                <div key={o.disciplineId}>
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">
                      {o.name} <span className="text-muted-foreground">· {o.credits} ЗЕТ</span>
                    </span>
                    <span className={cn("text-sm font-semibold tabular-nums", sessionHyp[o.disciplineId] < cfg.passScore && "text-destructive")}>
                      {sessionHyp[o.disciplineId]}
                    </span>
                  </div>
                  <Slider
                    value={[sessionHyp[o.disciplineId]]}
                    min={30}
                    max={100}
                    step={1}
                    thumbLabel={`Балл по предмету ${o.name}`}
                    onValueChange={([v]) => setSessionHyp((h) => ({ ...h, [o.disciplineId]: v }))}
                  />
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {[70, 80, 90].map((v) => (
                  <Button key={v} variant="outline" size="sm" onClick={() => setSessionHyp(Object.fromEntries(open.map((o) => [o.disciplineId, v])))}>
                    Всё на {v}
                  </Button>
                ))}
                <Button variant="ghost" size="sm" onClick={() => setSessionHyp(Object.fromEntries(open.map((o) => [o.disciplineId, o.predicted])))}>
                  По срезам
                </Button>
              </div>
            </div>
          )}
          {nextGoal && (
            <p className="mt-4 rounded-lg bg-secondary/70 px-3 py-2 text-sm text-secondary-foreground" data-testid="need-hint">
              {need === null
                ? `Порог «${nextGoal.label}» в эту сессию недостижим — смотрите на следующий семестр.`
                : need === 0
                  ? `Для порога «${nextGoal.label}» сессия уже не нужна — достаточно сдать без долгов.`
                  : `Чтобы выйти на порог «${nextGoal.label}» (${nextGoal.min}), сдайте сессию в среднем на ${need}+${nextGoal.blockedByDebt ? " и закройте долг" : ""}.`}
            </p>
          )}
        </section>
      )}

      <details className="rounded-2xl bg-card p-4 text-sm ring-1 ring-foreground/10">
        <summary className="flex cursor-pointer items-center gap-2 font-medium">
          <CircleHelp className="size-4" aria-hidden /> Как считается рейтинг
        </summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Средний балл по экзаменам и дифзачётам всех закрытых семестров, взвешенный по ЗЕТ.</li>
          <li>Зачёты без оценки в рейтинг не входят, но незачёт — это долг.</li>
          <li>Долг идёт в рейтинг с баллом последней попытки, пока не закрыт.</li>
          <li>Дисциплина, закрытая на пересдаче, идёт в рейтинг не выше {cfg.retakeMaxScore} баллов.</li>
          <li>Стипендия и кафедра требуют отсутствия долгов.</li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Это условные правила концепта. В реальном вузе их задаёт положение о БРС, а здесь — файл конфигурации.</p>
      </details>
    </div>
  );
}

function RetakeBlock({ d, now, value, onChange }: { d: DebtInfo; now: Date; value: number; onChange: (v: number) => void }) {
  const cfg = RATING_CONFIG;
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<string | null>(null);
  const left = d.ladder.filter((s) => s.result !== "failed").length;
  const passes = value >= cfg.passScore;
  const counted = passes ? Math.min(value, cfg.retakeMaxScore) : value;

  const go = (kind: "consultation" | "retake_application") => {
    setWhich(kind);
    start(() => quickRetakeRequestAction(d.disciplineId, kind));
  };

  return (
    <section className="rounded-2xl bg-destructive/5 p-4 ring-1 ring-destructive/25" aria-labelledby={`debt-${d.disciplineId}`} data-testid="retake-mode">
      <p className="text-xs font-semibold uppercase tracking-wide text-destructive">Режим пересдачи</p>
      <h2 id={`debt-${d.disciplineId}`} className="mt-0.5 text-lg font-semibold leading-snug">
        {d.name}
      </h2>
      <p className="text-sm text-muted-foreground">
        Осталось попыток: <b className="text-foreground">{left}</b> · {d.credits} ЗЕТ
      </p>

      <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Лестница попыток">
        {d.ladder.map((s) => {
          const at = s.at ? new Date(s.at) : null;
          return (
            <li
              key={s.kind}
              className={cn(
                "flex flex-col rounded-xl p-2 text-center ring-1",
                s.result === "failed" && "bg-destructive/10 text-destructive ring-destructive/20",
                s.result === "scheduled" && "bg-card ring-2 ring-primary",
                s.result === "passed" && "bg-success/15 ring-success/30",
                !s.result && "bg-card/60 text-muted-foreground ring-foreground/10",
              )}
            >
              <span className="text-[11px] font-medium leading-tight">{s.label}</span>
              <span className="mt-1 text-base font-semibold tabular-nums leading-none">
                {s.result === "failed" ? s.score : s.result === "scheduled" ? (at && at < now ? "?" : "→") : s.result === "passed" ? s.score : "·"}
              </span>
              <span className="mt-1 text-[11px] leading-tight">
                {at
                  ? s.result === "scheduled"
                    ? at < now
                      ? "ждём результат"
                      : relativeDay(at, now)
                    : formatDayMonth(at)
                  : "если понадобится"}
              </span>
            </li>
          );
        })}
      </ol>
      {d.ladder.find((s) => s.result === "scheduled" && s.at) &&
        (() => {
          const s = d.ladder.find((x) => x.result === "scheduled" && x.at)!;
          const at = new Date(s.at!);
          return (
            <p className="mt-2 text-sm">
              <b>{s.label}</b>
              {at < now
                ? ` прошла ${formatDayMonth(at)}, результат ещё не внесён. Учебный офис внесёт его в течение трёх рабочих дней.`
                : `: ${formatDayMonth(at)}, ${formatTime(at)}${s.room ? `, ${s.room}` : ""}`}
            </p>
          );
        })()}

      <div className="mt-5 rounded-xl bg-card p-3.5">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">Если пересдам на</span>
          <span className={cn("text-lg font-semibold tabular-nums", passes ? "text-success-foreground" : "text-destructive")} data-testid="retake-value">
            {value}
          </span>
        </div>
        <Slider value={[value]} min={30} max={100} step={1} thumbLabel={`Балл пересдачи: ${d.name}`} onValueChange={([v]) => onChange(v)} />
        <p className="mt-2.5 text-sm text-muted-foreground">
          {passes
            ? `Долг закрыт, в рейтинг пойдёт ${counted}${value > cfg.retakeMaxScore ? ` (потолок пересдачи ${cfg.retakeMaxScore})` : ""}.`
            : `Ниже ${cfg.passScore} — долг останется, впереди ещё ${Math.max(0, left - 1)} ${left - 1 === 1 ? "попытка" : "попытки"}.`}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[60, 70, 74].map((v) => (
            <Button key={v} variant="outline" size="sm" onClick={() => onChange(v)}>
              на {v}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button size="lg" onClick={() => go("consultation")} disabled={pending} data-testid="quick-consultation">
          {pending && which === "consultation" ? <Loader2 className="animate-spin" aria-hidden /> : <MessagesSquare aria-hidden />}
          Записаться на консультацию
        </Button>
        <Button size="lg" variant="outline" onClick={() => go("retake_application")} disabled={pending}>
          {pending && which === "retake_application" ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCcw aria-hidden />}
          Подать заявление
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Кнопка создаёт заявку в учебный офис — её статус виден в «Заявках».</p>
    </section>
  );
}
