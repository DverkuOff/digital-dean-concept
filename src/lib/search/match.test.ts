import { describe, expect, it } from "vitest";
import { matches, normalize, SECTIONS } from "./match";

describe("поиск", () => {
  it("нормализует регистр и ё", () => {
    expect(normalize("  Учёба  И ОЦЕНКИ ")).toBe("учеба и оценки");
  });
  it("все слова запроса, в любом порядке, по части слова", () => {
    expect(matches("справк обуч", "Справка об обучении")).toBe(true);
    expect(matches("обучении справка", "Справка об обучении")).toBe(true);
    expect(matches("справка военкомат", "Справка об обучении")).toBe(false);
  });
  it("пустой запрос ничего не находит", () => {
    expect(matches("   ", "что угодно")).toBe(false);
  });
  it("разделы находятся по ключевым словам", () => {
    expect(SECTIONS.filter((s) => matches("стипендия", s.title, s.keywords)).map((s) => s.href)).toEqual(["/rating"]);
  });
});
