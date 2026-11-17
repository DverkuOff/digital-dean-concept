// УСЛОВНЫЕ ПРАВИЛА КОНЦЕПТА. Вуз настраивает их здесь, код расчёта не меняется.
// Формула и обоснование: docs/specs/rating.md.

export type ControlType = "exam" | "diff_credit" | "credit";

export type Threshold = {
  id: string;
  label: string;
  description: string;
  min: number; // минимальный рейтинг
  requiresNoDebt: boolean;
};

export type GradeBand = { min: number; label: string; short: string };

export type RatingConfig = {
  /** Какие формы контроля дают балл в рейтинг (зачёт без оценки не даёт). */
  scoredControlTypes: ControlType[];
  /** Минимальный балл, при котором дисциплина считается сданной. */
  passScore: number;
  /** Потолок балла, если дисциплина закрыта на пересдаче. */
  retakeMaxScore: number;
  /** Пороги, которые показываются на шкале. */
  thresholds: Threshold[];
  /** Перевод 100-балльной оценки в словесную. */
  bands: GradeBand[];
  /** Попытки сдачи: основная + пересдачи + комиссия. */
  attemptsLadder: { kind: "main" | "retake1" | "retake2" | "commission"; label: string }[];
};

export const RATING_CONFIG: RatingConfig = {
  scoredControlTypes: ["exam", "diff_credit"],
  passScore: 60,
  retakeMaxScore: 74,
  thresholds: [
    {
      id: "scholarship",
      label: "Академическая стипендия",
      description: "Рейтинг от 70 и нет академических долгов",
      min: 70,
      requiresNoDebt: true,
    },
    {
      id: "third_language",
      label: "Третий иностранный язык",
      description: "Запись на третий язык при рейтинге от 75",
      min: 75,
      requiresNoDebt: false,
    },
    {
      id: "department",
      label: "Кафедра мировой экономики",
      description: "Проходной рейтинг прошлого года при распределении на кафедру",
      min: 82,
      requiresNoDebt: true,
    },
    {
      id: "increased_scholarship",
      label: "Повышенная стипендия",
      description: "Рейтинг от 90 и нет долгов",
      min: 90,
      requiresNoDebt: true,
    },
  ],
  bands: [
    { min: 90, label: "отлично", short: "5" },
    { min: 75, label: "хорошо", short: "4" },
    { min: 60, label: "удовлетворительно", short: "3" },
    { min: 0, label: "неудовлетворительно", short: "2" },
  ],
  attemptsLadder: [
    { kind: "main", label: "Экзамен" },
    { kind: "retake1", label: "Пересдача 1" },
    { kind: "retake2", label: "Пересдача 2" },
    { kind: "commission", label: "Комиссия" },
  ],
};
