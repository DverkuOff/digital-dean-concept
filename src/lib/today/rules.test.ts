import { describe, expect, it } from "vitest";
import { buildTodayCards, isValidCardKey, MAX_CARDS, stemOf, type TodayInput } from "./rules";

const now = new Date("2026-11-17T09:00:00+03:00");
const h = (hours: number) => new Date(now.getTime() + hours * 3600_000);
const empty = (): TodayInput => ({ now, lessonChanges: [], retakes: [], requests: [], deadlines: [], news: [], dismissed: new Set() });

describe("buildTodayCards", () => {
  it("пусто → нет карточек", () => {
    expect(buildTodayCards(empty())).toEqual([]);
  });

  it("перенос пары → карточка с было/стало", () => {
    const input = empty();
    input.lessonChanges.push({ id: "l1", status: "moved", startsAt: h(8), originalStartsAt: h(3), room: "ауд. 1", originalRoom: null, changeNote: "Конференция", discipline: "Эконометрика" });
    const [c] = buildTodayCards(input);
    expect(c.title).toBe("Перенос: Эконометрика");
    expect(c.body).toContain("12:00 → 17:00");
    expect(c.priority).toBe(0);
  });

  it("дедлайн про пересдачу схлопывается в карточку пересдачи", () => {
    const input = empty();
    input.retakes.push({ id: "r1", kind: "retake2", scheduledAt: h(24 * 9), room: "ауд. 2034", discipline: "Макроэкономика" });
    input.deadlines.push({ id: "d1", title: "Заявление на пересдачу", body: "Подайте заявление на пересдачу по макроэкономике", link: "/requests/new?type=retake_application", dueAt: h(24 * 5) });
    input.deadlines.push({ id: "d2", title: "Выбор темы курсовой", body: "Согласуйте тему", link: null, dueAt: h(24 * 8) });
    const cards = buildTodayCards(input);
    expect(cards).toHaveLength(2);
    const retake = cards.find((c) => c.kind === "retake")!;
    expect(retake.extra).toContain("заявление на пересдачу");
    expect(retake.href).toBe("/requests/new?type=retake_application");
    expect(cards.some((c) => c.key === "deadline:d1")).toBe(false);
  });

  it("«понял» скрывает карточку по ключу, новый возврат той же заявки — новый ключ", () => {
    const input = empty();
    input.requests.push({ id: "q1", type: "absence_excuse", status: "returned", updatedAt: h(-2), returnReason: "Даты", staffComment: null });
    const [c] = buildTodayCards(input);
    input.dismissed.add(c.key);
    expect(buildTodayCards(input)).toHaveLength(0);
    input.requests[0].updatedAt = h(-1);
    expect(buildTodayCards(input)).toHaveLength(1);
  });

  it("не больше MAX_CARDS, срочное выше", () => {
    const input = empty();
    for (let i = 0; i < 8; i++) input.news.push({ id: `n${i}`, title: `Новость ${i}`, body: "", publishedAt: h(-i) });
    input.lessonChanges.push({ id: "l1", status: "cancelled", startsAt: h(2), originalStartsAt: null, room: "ауд. 1", originalRoom: null, changeNote: null, discipline: "Право" });
    const cards = buildTodayCards(input);
    expect(cards).toHaveLength(MAX_CARDS);
    expect(cards[0].kind).toBe("schedule");
  });
});

describe("stemOf", () => {
  it("совпадает для разных падежей", () => {
    expect("по макроэкономике".includes(stemOf("Макроэкономика"))).toBe(true);
  });
});

describe("isValidCardKey", () => {
  it("принимает только ключи, которые строят правила", () => {
    expect(isValidCardKey("lesson:3f1c2b4a-1111-4222-8333-944455556666:moved")).toBe(true);
    expect(isValidCardKey("retake:3f1c2b4a-1111-4222-8333-944455556666")).toBe(true);
    expect(isValidCardKey("request:3f1c2b4a-1111-4222-8333-944455556666:returned:1763380000000")).toBe(true);
    expect(isValidCardKey("news:3f1c2b4a-1111-4222-8333-944455556666")).toBe(true);
    expect(isValidCardKey("x".repeat(150))).toBe(false);
    expect(isValidCardKey("lesson:not-a-uuid:moved")).toBe(false);
    expect(isValidCardKey("<script>")).toBe(false);
  });
});
