import { describe, expect, it } from "vitest";
import { examDay, eventTimes, isRuHoliday, lessonRange } from "./seed-calendar";
import { formatTime, mskDateKey } from "../src/lib/dates";

const at = (iso: string) => new Date(`${iso}+03:00`);
const hm = (d: Date) => formatTime(d);

describe("календарь сида", () => {
  it("праздники РФ: новогодние каникулы, 23 февраля, 8 марта, 1 и 9 мая, 12 июня, 4 ноября", () => {
    for (const k of ["2027-01-01", "2027-01-04", "2027-01-08", "2027-02-23", "2027-03-08", "2027-05-01", "2027-05-09", "2027-06-12", "2026-11-04"]) {
      expect(isRuHoliday(at(`${k}T12:00:00`)), k).toBe(true);
    }
    for (const k of ["2027-01-09", "2026-11-05", "2026-12-28"]) expect(isRuHoliday(at(`${k}T12:00:00`)), k).toBe(false);
  });

  it("экзамен не ставится на воскресенье и праздники", () => {
    expect(mskDateKey(examDay(at("2027-01-01T00:00:00")))).toBe("2027-01-09"); // 1–8 января выходные, 9-е — суббота
    expect(mskDateKey(examDay(at("2026-11-04T00:00:00")))).toBe("2026-11-05");
    expect(mskDateKey(examDay(at("2026-11-29T00:00:00")))).toBe("2026-11-30"); // воскресенье
    expect(mskDateKey(examDay(at("2026-12-28T00:00:00")))).toBe("2026-12-28");
  });

  it("пары начинаются с недели, где 1-е число прошлого месяца, но не раньше 1 сентября", () => {
    const r = lessonRange(at("2026-11-20T15:00:00"));
    expect(mskDateKey(r.from)).toBe("2026-09-28"); // неделя 1 октября
    expect(mskDateKey(r.notBefore)).toBe("2026-09-01");
    const early = lessonRange(at("2026-09-10T15:00:00"));
    expect(mskDateKey(early.notBefore)).toBe("2026-09-01");
    expect(early.from.getTime()).toBeLessThanOrEqual(early.notBefore.getTime());
    expect(early.from.getTime()).toBeGreaterThan(early.notBefore.getTime() - 7 * 86400000);
  });

  it("время событий: по порядку, не в будущем, в рабочие часы, не в одну минуту", () => {
    for (const nowIso of ["2026-11-20T15:00:00", "2026-11-22T03:30:00", "2026-11-23T09:10:00"]) {
      const now = at(nowIso);
      const steps = [
        { daysAgo: 4, actor: "student" as const },
        { daysAgo: 3, actor: "staff" as const },
        { daysAgo: 1, actor: "staff" as const },
        { daysAgo: 0, actor: "staff" as const },
      ];
      const t = eventTimes(now, steps, "req-1");
      for (let i = 0; i < t.length; i++) {
        expect(t[i].getTime(), nowIso).toBeLessThanOrEqual(now.getTime());
        if (i) expect(t[i].getTime()).toBeGreaterThan(t[i - 1].getTime());
        const [h, m] = hm(t[i]).split(":").map(Number);
        const min = h * 60 + m;
        if (steps[i].actor === "staff") {
          expect(min).toBeGreaterThanOrEqual(10 * 60);
          expect(min).toBeLessThan(17 * 60);
          const wd = new Date(`${mskDateKey(t[i])}T12:00:00Z`).getUTCDay();
          expect([0, 6]).not.toContain(wd); // методист не работает в выходные
        } else {
          expect(min).toBeGreaterThanOrEqual(9 * 60);
          expect(min).toBeLessThan(19 * 60);
        }
      }
      // Шаги одной заявки — не в одну и ту же минуту.
      expect(new Set(t.map(hm)).size).toBeGreaterThan(1);
    }
  });

  it("время детерминировано и зависит от соли", () => {
    const now = at("2026-11-20T15:00:00");
    const s = [{ daysAgo: 2, actor: "staff" as const }];
    expect(eventTimes(now, s, "a")[0].getTime()).toBe(eventTimes(now, s, "a")[0].getTime());
    const minutes = new Set(["a", "b", "c", "d", "e", "f"].map((k) => hm(eventTimes(now, s, k)[0])));
    expect(minutes.size).toBeGreaterThan(3);
  });
});
