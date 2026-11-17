// Правила главной «Сегодня»: чистая функция без БД. Спека: docs/specs/today.md.
import { getRequestType } from "@/lib/requests/catalog";
import { formatDayMonth, formatShortWeekday, formatTime, mskDayDiff, relativeDay } from "@/lib/dates";

export type TodayInput = {
  now: Date;
  lessonChanges: {
    id: string;
    status: "normal" | "moved" | "room_changed" | "cancelled";
    startsAt: Date;
    originalStartsAt: Date | null;
    room: string;
    originalRoom: string | null;
    changeNote: string | null;
    discipline: string;
  }[];
  retakes: { id: string; kind: string; scheduledAt: Date; room: string | null; discipline: string }[];
  requests: { id: string; type: string; status: string; updatedAt: Date; returnReason: string | null; staffComment: string | null }[];
  deadlines: { id: string; title: string; body: string; link: string | null; dueAt: Date }[];
  news: { id: string; title: string; body: string; publishedAt: Date }[];
  dismissed: Set<string>;
};

export type TodayCard = {
  key: string; // стабильный ключ для «понял»
  tone: "warning" | "danger" | "success" | "info";
  kind: "schedule" | "retake" | "request" | "deadline" | "news";
  title: string;
  body: string;
  extra?: string;
  href?: string;
  cta?: string;
  priority: number; // меньше — выше
  sortAt: number;
};

export const MAX_CARDS = 5;

const RETAKE_LABEL: Record<string, string> = { retake1: "Пересдача 1", retake2: "Пересдача 2", commission: "Комиссия" };

export function buildTodayCards(input: TodayInput): TodayCard[] {
  const { now } = input;
  const cards: TodayCard[] = [];

  // 1. Изменения в расписании на ближайшие дни.
  for (const l of input.lessonChanges) {
    const when = `${relativeDay(l.startsAt, now)}, ${formatShortWeekday(l.startsAt)}`;
    let title: string;
    let body: string;
    if (l.status === "moved") {
      title = `Перенос: ${l.discipline}`;
      const from = l.originalStartsAt ? `${formatTime(l.originalStartsAt)} → ` : "";
      body = `${when}: ${from}${formatTime(l.startsAt)}, ${l.room}`;
    } else if (l.status === "room_changed") {
      title = `Другая аудитория: ${l.discipline}`;
      body = `${when}, ${formatTime(l.startsAt)}: ${l.originalRoom ? `${l.originalRoom} → ` : ""}${l.room}`;
    } else {
      title = `Отменено: ${l.discipline}`;
      body = `${when}, ${formatTime(l.startsAt)}`;
    }
    cards.push({
      key: `lesson:${l.id}:${l.status}`,
      tone: "warning",
      kind: "schedule",
      title,
      body,
      extra: l.changeNote ?? undefined,
      href: "/schedule",
      cta: "Расписание",
      priority: mskDayDiff(now, l.startsAt) <= 1 ? 0 : 2,
      sortAt: l.startsAt.getTime(),
    });
  }

  // 2. Пересдачи в ближайшие три недели.
  const retakeCards: { card: TodayCard; stem: string }[] = [];
  for (const r of input.retakes) {
    const card: TodayCard = {
      key: `retake:${r.id}`,
      tone: "danger",
      kind: "retake",
      title: `${RETAKE_LABEL[r.kind] ?? "Пересдача"}: ${r.discipline} ${relativeDay(r.scheduledAt, now)}`,
      body: `${formatDayMonth(r.scheduledAt)}, ${formatTime(r.scheduledAt)}${r.room ? `, ${r.room}` : ""}`,
      href: "/rating",
      cta: "План пересдачи",
      priority: 1,
      sortAt: r.scheduledAt.getTime(),
    };
    cards.push(card);
    retakeCards.push({ card, stem: stemOf(r.discipline) });
  }

  // 3. Дедлайны. Схлопывание дублей: дедлайн про пересдачу того же предмета
  // не становится отдельной карточкой, а дописывается в карточку пересдачи.
  for (const d of input.deadlines) {
    const text = `${d.title} ${d.body}`.toLowerCase();
    const twin = text.includes("пересдач") ? retakeCards.find((r) => text.includes(r.stem)) : undefined;
    if (twin) {
      twin.card.extra = `Сначала: ${d.title.toLowerCase()} — срок ${relativeDay(d.dueAt, now)}, ${formatDayMonth(d.dueAt)}`;
      if (d.link) {
        twin.card.href = d.link;
        twin.card.cta = "Подать заявление";
      }
      continue;
    }
    cards.push({
      key: `deadline:${d.id}`,
      tone: "info",
      kind: "deadline",
      title: d.title,
      body: `Срок ${relativeDay(d.dueAt, now)}, ${formatDayMonth(d.dueAt)}. ${d.body}`,
      href: d.link ?? undefined,
      cta: d.link ? "Открыть" : undefined,
      priority: mskDayDiff(now, d.dueAt) <= 3 ? 1 : 3,
      sortAt: d.dueAt.getTime(),
    });
  }

  // 4. Заявки: готова или вернули.
  for (const r of input.requests) {
    const def = getRequestType(r.type);
    const name = def?.short ?? "Заявка";
    if (r.status === "returned") {
      cards.push({
        key: `request:${r.id}:returned:${r.updatedAt.getTime()}`,
        tone: "warning",
        kind: "request",
        title: `Заявку вернули: ${name.toLowerCase()}`,
        body: r.returnReason ?? "Нужно уточнение",
        href: `/requests/${r.id}`,
        cta: "Исправить",
        priority: 1,
        sortAt: r.updatedAt.getTime(),
      });
    } else if (r.status === "ready") {
      cards.push({
        key: `request:${r.id}:ready`,
        tone: "success",
        kind: "request",
        title: `Готово: ${name.toLowerCase()}`,
        body: r.staffComment ?? "Документ готов",
        href: `/requests/${r.id}`,
        cta: "Подробнее",
        priority: 2,
        sortAt: r.updatedAt.getTime(),
      });
    }
  }

  // 5. Важные новости последней недели.
  for (const n of input.news) {
    cards.push({
      key: `news:${n.id}`,
      tone: "info",
      kind: "news",
      title: n.title,
      body: n.body,
      href: "/notifications?tab=news",
      cta: "Новости",
      priority: 4,
      sortAt: -n.publishedAt.getTime(),
    });
  }

  return cards
    .filter((c) => !input.dismissed.has(c.key))
    .sort((a, b) => a.priority - b.priority || a.sortAt - b.sortAt)
    .slice(0, MAX_CARDS);
}

/** Основа слова без окончания: «Макроэкономика» и «по макроэкономике» совпадут. */
export function stemOf(name: string): string {
  const w = name.toLowerCase().split(/\s+/)[0];
  return w.length > 5 ? w.slice(0, w.length - 2) : w;
}
