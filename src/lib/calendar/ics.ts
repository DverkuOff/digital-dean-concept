// Сборка iCalendar (RFC 5545) без библиотек: чистая функция, тест — ics.test.ts.

export type IcsLesson = {
  id: string;
  title: string;
  type: "lecture" | "seminar" | "language";
  startsAt: Date;
  endsAt: Date;
  room: string;
  teacher: string;
  status: "normal" | "moved" | "room_changed" | "cancelled";
  originalStartsAt: Date | null;
  originalRoom: string | null;
  changeNote: string | null;
  changedAt: Date | null;
};

const TYPE = { lecture: "лекция", seminar: "семинар", language: "язык" } as const;

/** Экранирование текста по RFC 5545 §3.3.11. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Перенос длинных строк: не длиннее 75 октетов, продолжение начинается с пробела (§3.1). */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const len = enc.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // у продолжения первый октет — пробел
    if (curLen + len > limit) {
      parts.push(cur);
      cur = "";
      curLen = 0;
    }
    cur += ch;
    curLen += len;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

/** 2026-11-17T09:00:00.000Z → 20261117T090000Z */
export function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

const fmtHm = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export function buildIcs(opts: { calName: string; lessons: IcsLesson[]; now: Date; host: string }): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Orientir concept//Schedule//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(opts.calName)}`,
    `X-WR-CALDESC:${escapeText("Концепт для конкурса MGIMO×AI CHALLENGE, не официальный сервис, данные вымышлены. Переносы и отмены обновляются автоматически.")}`,
    "X-WR-TIMEZONE:Europe/Moscow",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const l of opts.lessons) {
    const notes: string[] = [`${TYPE[l.type]}, ${l.teacher}`];
    let summary = `${l.title} (${TYPE[l.type]})`;
    if (l.status === "moved" && l.originalStartsAt) {
      summary = `Перенос: ${summary}`;
      notes.push(`Перенесено с ${fmtHm.format(l.originalStartsAt)}`);
    }
    if (l.status === "room_changed" && l.originalRoom) notes.push(`Аудитория изменена: была ${l.originalRoom}`);
    if (l.status === "cancelled") summary = `Отменено: ${summary}`;
    if (l.changeNote) notes.push(l.changeNote);
    notes.push("Данные вымышлены (концепт)");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${l.id}@${opts.host}`,
      `DTSTAMP:${icsDate(opts.now)}`,
      `DTSTART:${icsDate(l.startsAt)}`,
      `DTEND:${icsDate(l.endsAt)}`,
      `SUMMARY:${escapeText(summary)}`,
      `LOCATION:${escapeText(l.room)}`,
      `DESCRIPTION:${escapeText(notes.join("\n"))}`,
      `STATUS:${l.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      // SEQUENCE растёт при изменении — календарь понимает, что событие обновилось.
      `SEQUENCE:${l.changedAt ? Math.floor(l.changedAt.getTime() / 1000) % 100000 : 0}`,
      ...(l.changedAt ? [`LAST-MODIFIED:${icsDate(l.changedAt)}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
