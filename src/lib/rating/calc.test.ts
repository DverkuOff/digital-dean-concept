import { describe, expect, it } from "vitest";
import { calcRating, cohortHistogram, estimatePlace, evaluateThresholds, gradeBand, placeInCohort, requiredAverageForTarget, summarizeCohort, type DisciplineResult } from "./calc";
import { RATING_CONFIG as cfg, type RatingConfig } from "./config";

const d = (id: string, credits: number, status: DisciplineResult["status"], finalScore: number | null, extra: Partial<DisciplineResult> = {}): DisciplineResult => ({
  disciplineId: id,
  name: id,
  credits,
  controlType: "exam",
  status,
  finalScore,
  passedOnRetake: false,
  ...extra,
});

// Профиль Орлова из сида: 34 ЗЕТ с оценкой, долг по макроэкономике (5 ЗЕТ, 48).
const orlov: DisciplineResult[] = [
  d("micro", 5, "passed", 74),
  d("matan", 5, "passed", 66),
  d("eng1", 4, "passed", 80, { controlType: "diff_credit" }),
  d("hist", 4, "passed", 75),
  d("intro", 2, "passed", null, { controlType: "credit" }),
  d("macro", 5, "debt", 48),
  d("linalg", 4, "passed", 68),
  d("eng2", 4, "passed", 78, { controlType: "diff_credit" }),
  d("law", 3, "passed", 61, { controlType: "diff_credit" }),
  d("ecmt", 5, "open", null),
  d("prob", 4, "open", null),
  d("pe", 1, "open", null, { controlType: "credit" }),
];

describe("calcRating", () => {
  it("средневзвешенный по ЗЕТ балл, зачёты без оценки не входят", () => {
    const r = calcRating([d("a", 5, "passed", 90), d("b", 3, "passed", 70), d("c", 2, "passed", null, { controlType: "credit" })], cfg);
    expect(r.rating).toBe(82.5); // (450 + 210) / 8
    expect(r.countedCredits).toBe(8);
    expect(r.hasDebt).toBe(false);
  });

  it("нечего считать → null", () => {
    expect(calcRating([d("a", 5, "open", null)], cfg).rating).toBeNull();
  });

  it("долг тянет рейтинг вниз баллом последней попытки и блокирует пороги без долгов", () => {
    const r = calcRating(orlov, cfg);
    expect(r.rating).toBe(68.4);
    expect(r.hasDebt).toBe(true);
    const th = evaluateThresholds(r, cfg);
    expect(th.find((t) => t.id === "scholarship")).toMatchObject({ reached: false, blockedByDebt: true, gap: 1.6 });
    expect(th.find((t) => t.id === "third_language")).toMatchObject({ reached: false, blockedByDebt: false });
  });

  it("пересдача на 70 закрывает долг и открывает стипендию (демо-момент)", () => {
    const r = calcRating(orlov, cfg, { macro: 70 });
    expect(r.rating).toBe(71.7);
    expect(r.hasDebt).toBe(false);
    expect(evaluateThresholds(r, cfg).find((t) => t.id === "scholarship")?.reached).toBe(true);
  });

  it("балл пересдачи выше потолка срезается до retakeMaxScore", () => {
    const hi = calcRating(orlov, cfg, { macro: 100 });
    const cap = calcRating(orlov, cfg, { macro: cfg.retakeMaxScore });
    expect(hi.rating).toBe(cap.rating);
    expect(hi.items.find((i) => i.disciplineId === "macro")?.score).toBe(74);
  });

  it("пересдача ниже порога — долг остаётся, в рейтинг идёт новый балл", () => {
    const r = calcRating(orlov, cfg, { macro: 55 });
    expect(r.hasDebt).toBe(true);
    expect(r.items.find((i) => i.disciplineId === "macro")).toMatchObject({ score: 55, source: "hypothesis" });
  });

  it("закрытая на пересдаче дисциплина идёт с потолком", () => {
    const r = calcRating([d("a", 4, "passed", 90, { passedOnRetake: true })], cfg);
    expect(r.rating).toBe(74);
  });

  it("открытая дисциплина в текущий рейтинг не входит, в прогноз — входит", () => {
    expect(calcRating(orlov, cfg).items.some((i) => i.disciplineId === "ecmt")).toBe(false);
    const p = calcRating(orlov, cfg, { ecmt: 90 });
    expect(p.items.find((i) => i.disciplineId === "ecmt")?.score).toBe(90);
  });

  it("незачёт в прогнозе сессии создаёт новый долг", () => {
    const r = calcRating([d("a", 5, "passed", 90), d("b", 4, "open", null)], cfg, { b: 40 });
    expect(r.hasDebt).toBe(true);
    expect(r.debtCount).toBe(1);
  });

  it("баллы вне 0–100 обрезаются", () => {
    const r = calcRating([d("a", 5, "open", null)], cfg, { a: 140 });
    expect(r.rating).toBe(100);
  });

  it("правила берутся из конфига: другой вуз — другой порог сдачи", () => {
    const strict: RatingConfig = { ...cfg, passScore: 50 };
    expect(calcRating(orlov, strict, { macro: 55 }).hasDebt).toBe(false);
  });
});

describe("placeInCohort", () => {
  it("место = 1 + число строго лучших; равные делят место", () => {
    expect(placeInCohort(80, [90, 85, 80, 70])).toEqual({ place: 3, total: 5, topPercent: 60 });
    expect(placeInCohort(95, [90, 85])).toMatchObject({ place: 1, total: 3 });
    expect(placeInCohort(null, [90])).toBeNull();
  });
});

describe("requiredAverageForTarget", () => {
  const base = [d("a", 4, "passed", 70), d("b", 4, "open", null)];
  it("считает нужный средний балл по открытым дисциплинам", () => {
    expect(requiredAverageForTarget(base, cfg, 75)).toBe(80); // (70*4 + x*4)/8 = 75
  });
  it("недостижимо → null, уже достигнуто → 0", () => {
    expect(requiredAverageForTarget(base, cfg, 90)).toBeNull();
    expect(requiredAverageForTarget([d("a", 4, "passed", 95), d("b", 4, "open", null)], cfg, 60)).toBe(25);
  });
});

describe("gradeBand", () => {
  it("переводит балл в словесную оценку по конфигу", () => {
    expect(gradeBand(95, cfg).label).toBe("отлично");
    expect(gradeBand(75, cfg).label).toBe("хорошо");
    expect(gradeBand(60, cfg).label).toBe("удовлетворительно");
    expect(gradeBand(10, cfg).label).toBe("неудовлетворительно");
  });
});

describe("место на курсе без чужих рейтингов", () => {
  const ratings = [95.4, 91, 88.2, 85, 82.5, 80, 77, 74.4, 70, 66, 61];
  it("гистограмма считает только количество в корзинах", () => {
    const h = cohortHistogram(ratings);
    expect(h.reduce((a, b) => a + b, 0)).toBe(ratings.length);
    expect(h[19]).toBe(1); // 95–100
    expect(h[18]).toBe(1); // 90–95
    expect(h.every((x) => Number.isInteger(x))).toBe(true);
  });
  it("меньше 10 однокурсников — место не показываем", () => {
    expect(summarizeCohort(ratings.slice(0, 9))).toBeNull();
    expect(summarizeCohort(ratings)?.n).toBe(11);
  });
  it("оценка по гистограмме близка к точному месту", () => {
    const sum = summarizeCohort(ratings)!;
    for (const r of [99, 89, 75, 68.4, 50]) {
      const exact = placeInCohort(r, ratings)!.place;
      expect(Math.abs(estimatePlace(r, sum)!.place - exact)).toBeLessThanOrEqual(1);
    }
    expect(estimatePlace(null, sum)).toBeNull();
    expect(estimatePlace(80, null)).toBeNull();
  });
});
