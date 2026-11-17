import { describe, expect, it } from "vitest";
import { addBusinessDays, formatScore, mskDateKey } from "./dates";

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
