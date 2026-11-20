import { describe, expect, it } from "vitest";
import { buildIcs, calendarHost, escapeText, foldLine, icsDate, type IcsLesson } from "./ics";

const base: IcsLesson = {
  id: "l1",
  title: "Эконометрика",
  type: "seminar",
  startsAt: new Date("2026-11-19T11:20:00Z"),
  endsAt: new Date("2026-11-19T12:40:00Z"),
  room: "ауд. 3047",
  teacher: "доц. Миронова Е. В.",
  status: "normal",
  originalStartsAt: null,
  originalRoom: null,
  changeNote: null,
  changedAt: null,
};
const now = new Date("2026-11-17T12:00:00Z");

describe("ics", () => {
  it("экранирует спецсимволы", () => {
    // Раньше тест закреплял баг: «;» не экранировалась, ведь в JS "\;" — это просто «;» (находка аудита М4).
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("переносит длинные строки не длиннее 75 октетов, не разрывая кириллицу", () => {
    const line = "DESCRIPTION:" + "Преподаватель на конференции, ".repeat(6);
    const folded = foldLine(line);
    for (const part of folded.split("\r\n")) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n").map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(line);
  });

  it("даты в UTC", () => {
    expect(icsDate(new Date("2026-11-17T09:05:07.123Z"))).toBe("20261117T090507Z");
  });

  it("собирает календарь: перенос и отмена видны, есть пометка концепта", () => {
    const ics = buildIcs({
      calName: "Ориентир · МЭО-204",
      now,
      host: "orientir.test",
      lessons: [
        { ...base, status: "moved", originalStartsAt: new Date("2026-11-19T08:20:00Z"), changeNote: "Конференция", changedAt: now },
        { ...base, id: "l2", status: "cancelled" },
      ],
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("SUMMARY:Перенос: Эконометрика\\, семинар");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("UID:l1@orientir.test");
    expect(ics.replace(/\r\n /g, "")).toContain("данные вымышлены");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  // ПМИ-2 (Д-10): за прокси приложение слушает 0.0.0.0:3000, и UID получался «…@0.0.0.0:3000».
  it("хост для UID — из BETTER_AUTH_URL, иначе из заголовков прокси, но не 0.0.0.0", () => {
    expect(calendarHost({ authUrl: "https://orientir.example.ru", forwardedHost: null, host: "0.0.0.0:3000", urlHost: "0.0.0.0:3000" })).toBe("orientir.example.ru");
    expect(calendarHost({ authUrl: undefined, forwardedHost: "orientir.example.ru", host: "0.0.0.0:3000", urlHost: "0.0.0.0:3000" })).toBe("orientir.example.ru");
    expect(calendarHost({ authUrl: "not a url", forwardedHost: null, host: "demo.local:3100", urlHost: "0.0.0.0:3000" })).toBe("demo.local:3100");
    expect(calendarHost({ authUrl: undefined, forwardedHost: null, host: "0.0.0.0:3000", urlHost: "0.0.0.0:3000" })).toBe("orientir.invalid");
  });

  it("в названии события нет двойных скобок", () => {
    const ics = buildIcs({ calName: "x", now, host: "h", lessons: [{ ...base, title: "Английский язык (3 сем.)", type: "language" }] });
    expect(ics).toContain("SUMMARY:Английский язык (3 сем.)\\, язык");
    expect(ics).not.toContain(") (");
  });
});
