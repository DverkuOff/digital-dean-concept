import type { Metadata } from "next";
import { getCohortRatings, getMyAttempts, getMyGrades, toResults } from "@/server/dal/grades";
import { RatingNavigator, type DebtInfo, type OpenInfo } from "./rating-navigator";
import { RATING_CONFIG } from "@/lib/rating/config";
import { calcRating, placeInCohort, summarizeCohort } from "@/lib/rating/calc";

export const metadata: Metadata = { title: "Рейтинг-навигатор" };

export default async function RatingPage() {
  const [grades, attempts, cohort] = await Promise.all([getMyGrades(), getMyAttempts(), getCohortRatings()]);
  const now = new Date();

  const open: OpenInfo[] = grades
    .filter((g) => g.status === "open" && RATING_CONFIG.scoredControlTypes.includes(g.controlType))
    .map((g) => {
      const s = [g.slice1, g.slice2, g.slice3].filter((x): x is number => x !== null);
      return {
        disciplineId: g.disciplineId,
        name: g.name,
        credits: g.credits,
        predicted: s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : 75,
      };
    });

  const debts: DebtInfo[] = grades
    .filter((g) => g.status === "debt")
    .map((g) => ({
      disciplineId: g.disciplineId,
      name: g.name,
      credits: g.credits,
      lastScore: g.finalScore ?? 0,
      ladder: RATING_CONFIG.attemptsLadder.map((step) => {
        const a = attempts.find((x) => x.disciplineId === g.disciplineId && x.kind === step.kind);
        return {
          kind: step.kind,
          label: step.label,
          result: a?.result ?? null,
          score: a?.score ?? null,
          at: a?.scheduledAt?.toISOString() ?? null,
          room: a?.room ?? null,
        };
      }),
    }));

  // Точные рейтинги однокурсников остаются на сервере (находка аудита В4):
  // в браузер — только точное место «сейчас» и грубая гистограмма для «что если».
  const results = toResults(grades);
  const summary = summarizeCohort(cohort);
  const placeNow = summary ? placeInCohort(calcRating(results, RATING_CONFIG).rating, cohort) : null;

  return (
    <RatingNavigator
      results={results}
      open={open}
      debts={debts}
      cohort={summary}
      placeNow={placeNow}
      nowIso={now.toISOString()}
    />
  );
}
