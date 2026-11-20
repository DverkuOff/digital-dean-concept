import { describe, expect, it } from "vitest";
import { addBusinessDays, formatMonthYear, formatScore, mskDateKey, startOfMskMonth } from "./dates";

describe("addBusinessDays", () => {
  it("пропускает выходные по Москве", () => {
    const fri = new Date("2026-11-20T10:00:00+03:00");
    expect(mskDateKey(addBusinessDays(fri, 1))).toBe("2026-11-23"); // пн
    expect(mskDateKey(addBusinessDays(fri, 2))).toBe("2026-11-24");
  });
  it("в будни считает подряд", () => {
    expect(mskDateKey(addBusinessDays(new Date("2026-11-17T10:00:00+03:00"), 2))).toBe("2026-11-19");
  });
  it("учитывает московскую полночь, а не UTC", () => {
    // 22.11 (вс) 01:00 по Москве = 21.11 22:00 UTC — это уже воскресенье
    expect(mskDateKey(addBusinessDays(new Date("2026-11-22T01:00:00+03:00"), 1))).toBe("2026-11-23");
  });
});

describe("formatScore", () => {
  it("десятичная запятая", () => {
    expect(formatScore(68.4)).toBe("68,4");
    expect(formatScore(null)).toBe("—");
  });
});

describe("startOfMskMonth", () => {
  it("месяц по Москве, а не по UTC: 30.11 23:30 МСК — ещё ноябрь", () => {
    const lateNov = new Date("2026-11-30T20:30:00Z"); // 23:30 МСК
    expect(mskDateKey(startOfMskMonth(lateNov))).toBe("2026-11-01");
  });
  it("сдвиг через год вперёд и назад", () => {
    const d = new Date("2026-11-20T10:00:00+03:00");
    expect(mskDateKey(startOfMskMonth(d, 2))).toBe("2027-01-01");
    expect(mskDateKey(startOfMskMonth(d, -11))).toBe("2025-12-01");
  });
  it("название месяца в именительном падеже", () => {
    expect(formatMonthYear(new Date("2026-11-20T10:00:00+03:00"))).toBe("Ноябрь 2026");
    expect(formatMonthYear(new Date("2027-01-05T10:00:00+03:00"))).toBe("Январь 2027");
  });
});
