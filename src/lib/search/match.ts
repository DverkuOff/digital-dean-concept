// Поиск: нормализация и сопоставление строк. Чистые функции, тест — match.test.ts.

/** Нижний регистр, ё → е, схлопнутые пробелы. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

/** Все слова запроса встречаются в тексте (в любом порядке, по началу слова или внутри). */
export function matches(query: string, ...texts: (string | null | undefined)[]): boolean {
  const q = normalize(query);
  if (!q) return false;
  const hay = normalize(texts.filter(Boolean).join(" "));
  return q.split(" ").every((w) => hay.includes(w));
}

export type SearchHit = { group: "Разделы" | "Заказать" | "Дисциплины" | "Мои заявки" | "Объявления"; title: string; subtitle?: string; href: string };

export const SECTIONS: { title: string; href: string; keywords: string }[] = [
  { title: "Сегодня", href: "/today", keywords: "главная лента важное карточки" },
  { title: "Расписание", href: "/schedule", keywords: "пары занятия неделя аудитория перенос" },
  { title: "Расписание в календаре", href: "/schedule/calendar", keywords: "ics календарь подписка google apple яндекс" },
  { title: "Учёба и оценки", href: "/grades", keywords: "оценки баллы срезы сессия зачетка успеваемость экзамены" },
  { title: "Рейтинг-навигатор", href: "/rating", keywords: "рейтинг стипендия третий язык кафедра пересдача место на курсе" },
  { title: "Мои заявки", href: "/requests", keywords: "справки заявления статус" },
  { title: "Новая заявка", href: "/requests/new", keywords: "заказать справку заявление" },
  { title: "Уведомления", href: "/notifications", keywords: "дедлайны напоминания" },
  { title: "Новости деканата", href: "/notifications?tab=news", keywords: "объявления деканат" },
  { title: "Профиль", href: "/profile", keywords: "группа факультет зачетная книжка выйти" },
];

export const MIN_QUERY = 2;
export const MAX_QUERY = 60;
