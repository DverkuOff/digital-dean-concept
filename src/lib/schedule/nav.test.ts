import { describe, expect, it } from "vitest";
import { changesTitle, parseSchedule, scheduleTabs } from "./nav";
import { mskDateKey } from "@/lib/dates";

const now = new Date("2026-11-20T15:00:00+03:00"); // пт, неделя 16–21 ноября

describe("параметры расписания", () => {
  it("крайние d/w/m зажимаются в разумные пределы, мусор — сегодня", () => {
    expect(mskDateKey(parseSchedule({ d: "9999-12-31" }, now).day)).toBe("2027-11-20");
    expect(mskDateKey(parseSchedule({ d: "0001-01-01" }, now).day)).toBe("2025-11-20");
    expect(mskDateKey(parseSchedule({ d: "2026-13-45" }, now).day)).toBe("2026-11-20");
    expect(mskDateKey(parseSchedule({ d: "abc" }, now).day)).toBe("2026-11-20");
    expect(parseSchedule({ view: "week", w: "999" }, now).weekOffset).toBe(52);
    expect(parseSchedule({ view: "week", w: "-999" }, now).weekOffset).toBe(-52);
    expect(parseSchedule({ view: "month", m: "99" }, now).monthOffset).toBe(2);
    expect(parseSchedule({ view: "month", m: "-5" }, now).monthOffset).toBe(-1);
  });

  it("вкладки из выбранного дня ведут в его неделю и месяц", () => {
    const t = scheduleTabs(parseSchedule({ d: "2026-12-02" }, now), now);
    expect(t.week).toBe("/schedule?view=week&w=2");
    expect(t.month).toBe("/schedule?view=month&m=1");
    expect(t.day).toBe("/schedule?d=2026-12-02");
  });

  it("«День» из месяца — первый день месяца или сегодня, если он внутри", () => {
    expect(scheduleTabs(parseSchedule({ view: "month", m: "1" }, now), now).day).toBe("/schedule?d=2026-12-01");
    expect(scheduleTabs(parseSchedule({ view: "month", m: "0" }, now), now).day).toBe("/schedule");
    expect(scheduleTabs(parseSchedule({ view: "month", m: "1" }, now), now).week).toBe("/schedule?view=week&w=2");
  });

  it("«День» из недели — понедельник той недели или сегодня", () => {
    expect(scheduleTabs(parseSchedule({ view: "week", w: "3" }, now), now).day).toBe("/schedule?d=2026-12-07");
    expect(scheduleTabs(parseSchedule({ view: "week", w: "0" }, now), now).day).toBe("/schedule");
    expect(scheduleTabs(parseSchedule({ view: "week", w: "3" }, now), now).month).toBe("/schedule?view=month&m=1");
  });

  it("заголовок изменений называет неделю", () => {
    const p = (w: number) => parseSchedule({ view: "week", w: String(w) }, now).weekStart;
    expect(changesTitle(p(0), now)).toBe("на этой неделе");
    expect(changesTitle(p(1), now)).toBe("на следующей неделе");
    expect(changesTitle(p(-1), now)).toBe("на прошлой неделе");
    expect(changesTitle(p(3), now)).toBe("на неделе 7–12 декабря");
  });
});
