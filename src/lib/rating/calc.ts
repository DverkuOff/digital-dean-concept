// Расчёт рейтинга: чистые функции без БД и времени. Спека: docs/specs/rating.md.
import type { ControlType, RatingConfig } from "./config";

export type DisciplineResult = {
  disciplineId: string;
  name: string;
  credits: number;
  controlType: ControlType;
  /** open — сессия впереди; passed — закрыта; debt — академический долг. */
  status: "open" | "passed" | "debt";
  /** Итоговый балл (для debt — балл последней попытки). null у открытых. */
  finalScore: number | null;
  passedOnRetake: boolean;
};

/** Гипотетические баллы «если сдам на N» по открытым дисциплинам и долгам. */
export type Hypothesis = Record<string, number>;

export type CountedItem = {
  disciplineId: string;
  name: string;
  credits: number;
  score: number; // балл, который идёт в рейтинг
  source: "closed" | "debt" | "hypothesis";
};

export type RatingResult = {
  rating: number | null; // null — ещё нечего считать
  countedCredits: number;
  hasDebt: boolean;
  debtCount: number;
  items: CountedItem[];
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Рейтинг = средневзвешенный по ЗЕТ балл по дисциплинам с оценкой (экзамен, дифзачёт).
 * - Закрытая дисциплина: итоговый балл; если закрыта на пересдаче — не выше retakeMaxScore.
 * - Долг: идёт в рейтинг с баллом последней попытки (тянет вниз), пока не закрыт.
 * - Открытая дисциплина: в текущий рейтинг не входит; в прогноз — с гипотетическим баллом.
 * - Гипотеза по долгу: при балле ≥ passScore долг закрывается (с потолком пересдачи).
 */
export function calcRating(results: DisciplineResult[], config: RatingConfig, hypothesis: Hypothesis = {}): RatingResult {
  const items: CountedItem[] = [];
  let debtCount = 0;

  for (const r of results) {
    const scored = config.scoredControlTypes.includes(r.controlType);
    const hyp = hypothesis[r.disciplineId];
    const hasHyp = typeof hyp === "number" && Number.isFinite(hyp);

    if (r.status === "passed") {
      if (!scored || r.finalScore === null) continue;
      const score = r.passedOnRetake ? Math.min(r.finalScore, config.retakeMaxScore) : r.finalScore;
      items.push({ disciplineId: r.disciplineId, name: r.name, credits: r.credits, score: clamp(score, 0, 100), source: "closed" });
      continue;
    }

    if (r.status === "debt") {
      if (hasHyp && hyp >= config.passScore) {
        // долг закрыт на пересдаче
        if (scored) {
          items.push({
            disciplineId: r.disciplineId,
            name: r.name,
            credits: r.credits,
            score: Math.min(clamp(hyp, 0, 100), config.retakeMaxScore),
            source: "hypothesis",
          });
        }
        continue;
      }
      debtCount++;
      if (scored) {
        const score = hasHyp ? hyp : (r.finalScore ?? 0);
        items.push({ disciplineId: r.disciplineId, name: r.name, credits: r.credits, score: clamp(score, 0, 100), source: hasHyp ? "hypothesis" : "debt" });
      }
      continue;
    }

    // open
    if (!hasHyp) continue;
    if (hyp < config.passScore) debtCount++;
    if (scored) {
      items.push({ disciplineId: r.disciplineId, name: r.name, credits: r.credits, score: clamp(hyp, 0, 100), source: "hypothesis" });
    }
  }

  const countedCredits = items.reduce((s, i) => s + i.credits, 0);
  const rating = countedCredits > 0 ? round1(items.reduce((s, i) => s + i.score * i.credits, 0) / countedCredits) : null;

  return { rating, countedCredits, hasDebt: debtCount > 0, debtCount, items };
}

export type ThresholdState = {
  id: string;
  label: string;
  description: string;
  min: number;
  requiresNoDebt: boolean;
  reached: boolean;
  /** Сколько баллов рейтинга не хватает (0, если хватает). */
  gap: number;
  blockedByDebt: boolean;
};

export function evaluateThresholds(result: RatingResult, config: RatingConfig): ThresholdState[] {
  return config.thresholds.map((t) => {
    const r = result.rating ?? 0;
    const scoreOk = r >= t.min;
    const blockedByDebt = t.requiresNoDebt && result.hasDebt;
    return {
      ...t,
      reached: scoreOk && !blockedByDebt,
      gap: scoreOk ? 0 : round1(t.min - r),
      blockedByDebt,
    };
  });
}

/**
 * Место на курсе: 1 + число однокурсников со строго бóльшим рейтингом.
 * На вход — только числа (агрегат), без имён и оценок.
 */
export function placeInCohort(myRating: number | null, othersRatings: number[]): { place: number; total: number; topPercent: number } | null {
  if (myRating === null) return null;
  const higher = othersRatings.filter((r) => r > myRating).length;
  const total = othersRatings.length + 1;
  const place = higher + 1;
  return { place, total, topPercent: Math.max(1, Math.round((place / total) * 100)) };
}

/**
 * Какой средний балл нужен по открытым дисциплинам, чтобы прогноз дотянул до цели.
 * null — недостижимо даже при 100 баллах; 0 — цель уже достигнута без них.
 */
export function requiredAverageForTarget(
  results: DisciplineResult[],
  config: RatingConfig,
  target: number,
  fixed: Hypothesis = {},
): number | null {
  const open = results.filter((r) => r.status === "open" && config.scoredControlTypes.includes(r.controlType));
  if (open.length === 0) return null;
  const base = calcRating(results, config, fixed);
  const baseSum = (base.rating ?? 0) * base.countedCredits;
  const openCredits = open.filter((r) => fixed[r.disciplineId] === undefined).reduce((s, r) => s + r.credits, 0);
  if (openCredits === 0) return null;
  const need = (target * (base.countedCredits + openCredits) - baseSum) / openCredits;
  if (need > 100) return null;
  return Math.max(0, Math.ceil(need));
}

export function gradeBand(score: number, config: RatingConfig) {
  return config.bands.find((b) => score >= b.min) ?? config.bands[config.bands.length - 1];
}
