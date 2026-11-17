// Демо-данные. ВСЁ ВЫМЫШЛЕНО: имена, оценки, аудитории, преподаватели.
// Все даты считаются от момента запуска (now), чтобы демо не «протухало».
import { randomUUID } from "node:crypto";
import { hash } from "@node-rs/argon2";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as s from "../src/server/db/schema";
import { ARGON2_OPTIONS } from "../src/server/password-opts";
import { DAY_MS, addDays, mskAt, startOfMskDay, startOfMskWeek } from "../src/lib/dates";

type DB = NodePgDatabase<typeof s>;

export const DEMO_PASSWORD = "demo2026";
const STAFF_NAME = "Елена Белова";
export const DEMO_LOGINS = { a: "sokolova", b: "orlov", staff: "metodist" } as const;

// Детерминированный ГПСЧ: одинаковые однокурсники при каждом сбросе.
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261117);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const gauss = () => {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

const FACULTY = "Международных экономических отношений";
const PROGRAM = "38.03.01 Экономика: мировая экономика";
const COHORT = "МЭО-2025";
const GROUP_A = "МЭО-201";
const GROUP_B = "МЭО-204";

// Пары по 80 минут.
const SLOTS: [number, number][] = [
  [9, 0],
  [10, 40],
  [12, 40],
  [14, 20],
  [16, 0],
  [17, 40],
];

type DiscKey =
  | "micro" | "matan" | "eng1" | "hist" | "intro"
  | "macro" | "linalg" | "eng2" | "law" | "inf"
  | "ecmt" | "worldec" | "eng3" | "french" | "prob" | "pe";

const DISCIPLINES: Record<DiscKey, { name: string; short: string; credits: number; control: "exam" | "diff_credit" | "credit"; semester: number; teacher: string }> = {
  micro: { name: "Микроэкономика", short: "Микро", credits: 5, control: "exam", semester: 1, teacher: "проф. Ларионов А. С." },
  matan: { name: "Математический анализ", short: "Матан", credits: 5, control: "exam", semester: 1, teacher: "доц. Гречко В. П." },
  eng1: { name: "Английский язык (1 сем.)", short: "Англ.", credits: 4, control: "diff_credit", semester: 1, teacher: "ст. преп. Уварова М. И." },
  hist: { name: "История международных отношений", short: "ИМО", credits: 4, control: "exam", semester: 1, teacher: "проф. Северцев Д. К." },
  intro: { name: "Введение в специальность", short: "Введение", credits: 2, control: "credit", semester: 1, teacher: "доц. Каверина О. Н." },
  macro: { name: "Макроэкономика", short: "Макро", credits: 5, control: "exam", semester: 2, teacher: "доц. Вяземский П. Р." },
  linalg: { name: "Линейная алгебра", short: "Линал", credits: 4, control: "exam", semester: 2, teacher: "доц. Гречко В. П." },
  eng2: { name: "Английский язык (2 сем.)", short: "Англ.", credits: 4, control: "diff_credit", semester: 2, teacher: "ст. преп. Уварова М. И." },
  law: { name: "Основы права", short: "Право", credits: 3, control: "diff_credit", semester: 2, teacher: "доц. Белозёрова Т. А." },
  inf: { name: "Информатика", short: "Информ.", credits: 2, control: "credit", semester: 2, teacher: "ст. преп. Зотов Е. Ю." },
  ecmt: { name: "Эконометрика", short: "Эконометрика", credits: 5, control: "exam", semester: 3, teacher: "доц. Миронова Е. В." },
  worldec: { name: "Мировая экономика", short: "Мир. экономика", credits: 5, control: "exam", semester: 3, teacher: "проф. Абрамцев Н. Г." },
  eng3: { name: "Английский язык (3 сем.)", short: "Английский", credits: 4, control: "exam", semester: 3, teacher: "ст. преп. Уварова М. И." },
  french: { name: "Французский язык", short: "Французский", credits: 4, control: "diff_credit", semester: 3, teacher: "ст. преп. Ренар-Кузнецова Л. Ф." },
  prob: { name: "Теория вероятностей", short: "Теорвер", credits: 4, control: "exam", semester: 3, teacher: "доц. Шайхутдинов Р. М." },
  pe: { name: "Физическая культура", short: "Физкультура", credits: 1, control: "credit", semester: 3, teacher: "ст. преп. Ковалёв И. А." },
};

const CLOSED: DiscKey[] = ["micro", "matan", "eng1", "hist", "intro", "macro", "linalg", "eng2", "law", "inf"];
const OPEN: DiscKey[] = ["ecmt", "worldec", "eng3", "french", "prob", "pe"];

// Недельный шаблон: [день недели 0=пн, слот, дисциплина, тип, аудитория].
type Tpl = [number, number, DiscKey, "lecture" | "seminar" | "language", string];
const COMMON_LECTURES: Tpl[] = [
  [0, 0, "ecmt", "lecture", "ауд. 1012 (поточная)"],
  [1, 1, "worldec", "lecture", "ауд. 1012 (поточная)"],
  [2, 0, "prob", "lecture", "ауд. 2001 (поточная)"],
  [4, 0, "worldec", "lecture", "ауд. 1012 (поточная)"],
];
const GROUP_TPL: Record<string, Tpl[]> = {
  [GROUP_A]: [
    [0, 1, "ecmt", "seminar", "ауд. 3045"],
    [0, 2, "eng3", "language", "ауд. 214 (лингафонная)"],
    [1, 2, "worldec", "seminar", "ауд. 3112"],
    [1, 3, "french", "language", "ауд. 418"],
    [2, 1, "prob", "seminar", "ауд. 2107"],
    [2, 3, "pe", "seminar", "Спорткомплекс, зал 2"],
    [3, 1, "eng3", "language", "ауд. 214 (лингафонная)"],
    [3, 2, "french", "language", "ауд. 418"],
    [4, 1, "prob", "seminar", "ауд. 2107"],
  ],
  [GROUP_B]: [
    [0, 2, "ecmt", "seminar", "ауд. 3047"],
    [0, 3, "eng3", "language", "ауд. 216 (лингафонная)"],
    [1, 2, "french", "language", "ауд. 420"],
    [1, 3, "worldec", "seminar", "ауд. 3114"],
    [2, 1, "prob", "seminar", "ауд. 2109"],
    [3, 1, "french", "language", "ауд. 420"],
    [3, 2, "eng3", "language", "ауд. 216 (лингафонная)"],
    [3, 3, "ecmt", "seminar", "ауд. 3047"],
    [4, 1, "prob", "seminar", "ауд. 2109"],
    [5, 2, "pe", "seminar", "Спорткомплекс, зал 1"],
  ],
};

const LAST = ["Абрамова", "Белов", "Воронцова", "Гусев", "Демидова", "Ершов", "Жукова", "Зайцев", "Ильина", "Ковалёв", "Лебедева", "Морозов", "Никитина", "Осипов", "Павлова", "Романов", "Савина", "Тихонов", "Ушакова", "Фёдоров", "Харитонова", "Цветков", "Чернова", "Шестаков", "Щукина", "Юдин", "Яковлева", "Карпов", "Мельникова", "Соловьёв"];
const FIRST_F = ["Алиса", "Вера", "Дарья", "Ева", "Злата", "Ксения", "Мария", "Полина", "София", "Ульяна"];
const FIRST_M = ["Артём", "Глеб", "Денис", "Егор", "Илья", "Кирилл", "Лев", "Марк", "Никита", "Тимур"];

export async function seed(db: DB, now = new Date()) {
  const today = startOfMskDay(now);
  const weekStart = startOfMskWeek(now);

  /* ── Дисциплины ── */
  const discId = {} as Record<DiscKey, string>;
  for (const [key, d] of Object.entries(DISCIPLINES) as [DiscKey, (typeof DISCIPLINES)[DiscKey]][]) {
    const id = randomUUID();
    discId[key] = id;
    await db.insert(s.discipline).values({ id, name: d.name, shortName: d.short, credits: d.credits, controlType: d.control, semester: d.semester, teacher: d.teacher });
  }

  /* ── Пользователи с входом ── */
  const passwordHash = await hash(DEMO_PASSWORD, ARGON2_OPTIONS);
  async function createUser(username: string, name: string, role: "student" | "staff") {
    const id = randomUUID();
    await db.insert(s.user).values({ id, name, email: `${username}@demo.invalid`, emailVerified: true, username, displayUsername: username, role });
    await db.insert(s.account).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: passwordHash });
    return id;
  }
  const userA = await createUser(DEMO_LOGINS.a, "Анна Соколова", "student");
  const userB = await createUser(DEMO_LOGINS.b, "Максим Орлов", "student");
  await createUser(DEMO_LOGINS.staff, STAFF_NAME, "staff");

  /* ── Студенты ── */
  const base = { faculty: FACULTY, program: PROGRAM, course: 2, cohort: COHORT, fundingType: "бюджет" };
  const studentA = randomUUID();
  const studentB = randomUUID();
  await db.insert(s.student).values([
    { id: studentA, userId: userA, lastName: "Соколова", firstName: "Анна", middleName: "Дмитриевна", groupCode: GROUP_A, recordBook: "25-МЭО-0147", ...base },
    { id: studentB, userId: userB, lastName: "Орлов", firstName: "Максим", middleName: "Игоревич", groupCode: GROUP_B, recordBook: "25-МЭО-0392", ...base },
  ]);

  /* ── Оценки демо-студентов ── */
  type G = { key: DiscKey; final?: number; status: "open" | "passed" | "debt"; slices?: [number | null, number | null, number | null]; retake?: boolean };
  const gradesA: G[] = [
    { key: "micro", final: 91, status: "passed", slices: [88, 92, 90] },
    { key: "matan", final: 86, status: "passed", slices: [82, 85, 88] },
    { key: "eng1", final: 88, status: "passed", slices: [90, 86, 88] },
    { key: "hist", final: 84, status: "passed", slices: [80, 86, 85] },
    { key: "intro", status: "passed" },
    { key: "macro", final: 85, status: "passed", slices: [84, 83, 88] },
    { key: "linalg", final: 89, status: "passed", slices: [86, 90, 91] },
    { key: "eng2", final: 90, status: "passed", slices: [91, 89, 90] },
    { key: "law", final: 87, status: "passed", slices: [85, 88, 87] },
    { key: "inf", status: "passed" },
    { key: "ecmt", status: "open", slices: [92, 88, null] },
    { key: "worldec", status: "open", slices: [86, 90, null] },
    { key: "eng3", status: "open", slices: [91, 93, null] },
    { key: "french", status: "open", slices: [84, 87, null] },
    { key: "prob", status: "open", slices: [80, 85, null] },
    { key: "pe", status: "open" },
  ];
  // Орлов: долг по макроэкономике (последняя попытка 48). Рейтинг 68,4; при пересдаче на 70 — 71,7.
  const gradesB: G[] = [
    { key: "micro", final: 74, status: "passed", slices: [70, 72, 75] },
    { key: "matan", final: 66, status: "passed", slices: [61, 64, 68] },
    { key: "eng1", final: 80, status: "passed", slices: [78, 81, 80] },
    { key: "hist", final: 75, status: "passed", slices: [72, 77, 74] },
    { key: "intro", status: "passed" },
    { key: "macro", final: 48, status: "debt", slices: [52, 45, 50] },
    { key: "linalg", final: 68, status: "passed", slices: [64, 66, 70] },
    { key: "eng2", final: 78, status: "passed", slices: [76, 79, 78] },
    { key: "law", final: 61, status: "passed", slices: [58, 60, 63] },
    { key: "inf", status: "passed" },
    { key: "ecmt", status: "open", slices: [55, 62, null] },
    { key: "worldec", status: "open", slices: [70, 66, null] },
    { key: "eng3", status: "open", slices: [78, 74, null] },
    { key: "french", status: "open", slices: [65, 70, null] },
    { key: "prob", status: "open", slices: [50, 58, null] },
    { key: "pe", status: "open" },
  ];
  const insertGrades = async (studentId: string, list: G[]) => {
    await db.insert(s.grade).values(
      list.map((g) => ({
        studentId,
        disciplineId: discId[g.key],
        slice1: g.slices?.[0] ?? null,
        slice2: g.slices?.[1] ?? null,
        slice3: g.slices?.[2] ?? null,
        finalScore: g.final ?? null,
        status: g.status,
        passedOnRetake: g.retake ?? false,
        updatedAt: addDays(now, -20),
      })),
    );
  };
  await insertGrades(studentA, gradesA);
  await insertGrades(studentB, gradesB);

  /* ── ~60 вымышленных однокурсников (без входа, только для агрегата) ── */
  const groups = ["МЭО-201", "МЭО-202", "МЭО-203", "МЭО-204"];
  for (let i = 0; i < 60; i++) {
    const female = rand() < 0.55;
    const last0 = pick(LAST);
    const lastName = female ? (last0.endsWith("а") ? last0 : last0 + "а") : last0.endsWith("а") ? last0.slice(0, -1) : last0;
    const id = randomUUID();
    await db.insert(s.student).values({
      id,
      lastName,
      firstName: female ? pick(FIRST_F) : pick(FIRST_M),
      groupCode: groups[i % groups.length],
      recordBook: `25-МЭО-${String(500 + i).padStart(4, "0")}`,
      ...base,
    });
    const level = 76 + gauss() * 8;
    const rows = [...CLOSED, ...OPEN].map((key) => {
      const d = DISCIPLINES[key];
      const isOpen = OPEN.includes(key);
      if (d.control === "credit") {
        return { studentId: id, disciplineId: discId[key], status: (isOpen ? "open" : "passed") as "open" | "passed", finalScore: null, slice1: null, slice2: null, slice3: null };
      }
      const sc = clamp(level + gauss() * 6, 40, 100);
      if (isOpen) {
        return { studentId: id, disciplineId: discId[key], status: "open" as const, finalScore: null, slice1: clamp(sc + gauss() * 4, 30, 100), slice2: clamp(sc + gauss() * 4, 30, 100), slice3: null };
      }
      return { studentId: id, disciplineId: discId[key], status: (sc < 60 ? "debt" : "passed") as "debt" | "passed", finalScore: sc, slice1: clamp(sc + gauss() * 4, 30, 100), slice2: clamp(sc + gauss() * 4, 30, 100), slice3: clamp(sc + gauss() * 4, 30, 100) };
    });
    await db.insert(s.grade).values(rows);
  }

  /* ── Попытки сдачи: долг Орлова и расписание зимней сессии ── */
  await db.insert(s.examAttempt).values([
    { studentId: studentB, disciplineId: discId.macro, kind: "main", scheduledAt: mskAt(addDays(today, -150), 10), room: "ауд. 1012", score: 41, result: "failed" },
    { studentId: studentB, disciplineId: discId.macro, kind: "retake1", scheduledAt: mskAt(addDays(today, -55), 12, 40), room: "ауд. 2034", score: 48, result: "failed" },
    { studentId: studentB, disciplineId: discId.macro, kind: "retake2", scheduledAt: mskAt(addDays(today, 9), 11), room: "ауд. 2034", score: null, result: "scheduled" },
  ]);
  const sessionStart = addDays(today, 38);
  const sessionExams: DiscKey[] = ["ecmt", "worldec", "eng3", "prob"];
  for (const sid of [studentA, studentB]) {
    await db.insert(s.examAttempt).values(
      sessionExams.map((key, i) => ({
        studentId: sid,
        disciplineId: discId[key],
        kind: "main" as const,
        scheduledAt: mskAt(addDays(sessionStart, i * 4), 10),
        room: pick(["ауд. 1012", "ауд. 2001", "ауд. 3045"]),
        score: null,
        result: "scheduled" as const,
      })),
    );
  }

  /* ── Расписание: от 2 недель назад до 7 недель вперёд ── */
  const lessons: (typeof s.lesson.$inferInsert)[] = [];
  for (let w = -2; w <= 7; w++) {
    const monday = addDays(weekStart, w * 7);
    for (const group of [GROUP_A, GROUP_B]) {
      for (const [dow, slot, key, type, room] of [...COMMON_LECTURES, ...GROUP_TPL[group]]) {
        const [h, m] = SLOTS[slot];
        const startsAt = mskAt(addDays(monday, dow), h, m);
        lessons.push({
          id: randomUUID(),
          groupCode: group,
          disciplineId: discId[key],
          type,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 80 * 60 * 1000),
          room,
          teacher: DISCIPLINES[key].teacher,
        });
      }
    }
  }
  lessons.sort((x, y) => x.startsAt!.getTime() - y.startsAt!.getTime());

  // Изменения у группы Орлова: ближайший семинар переносим на последнюю пару того же дня,
  // следующая пара меняет аудиторию, ещё одна через несколько дней отменяется.
  // Плюс по одному переносу в каждую следующую неделю, чтобы демо не устаревало.
  const fromToday = (g: string) => lessons.filter((l) => l.groupCode === g && l.startsAt!.getTime() >= today.getTime());
  const bLessons = fromToday(GROUP_B);
  const bUpcoming = bLessons.filter((l) => l.startsAt!.getTime() > now.getTime());
  const firstSeminar = bUpcoming.find((l) => l.type === "seminar" && l.disciplineId === discId.ecmt) ?? bUpcoming.find((l) => l.type === "seminar");
  if (firstSeminar) {
    const [h, m] = SLOTS[5];
    firstSeminar.originalStartsAt = firstSeminar.startsAt;
    firstSeminar.startsAt = mskAt(firstSeminar.startsAt!, h, m);
    firstSeminar.endsAt = new Date(firstSeminar.startsAt.getTime() + 80 * 60 * 1000);
    firstSeminar.status = "moved";
    firstSeminar.changeNote = "Преподаватель на конференции, семинар перенесён на вечер";
    firstSeminar.changedAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  }
  const roomChange = bUpcoming.find((l) => l !== firstSeminar && l.type === "language");
  if (roomChange) {
    roomChange.originalRoom = roomChange.room;
    roomChange.room = "ауд. 3201";
    roomChange.status = "room_changed";
    roomChange.changeNote = "В лингафонной аудитории ремонт";
    roomChange.changedAt = new Date(now.getTime() - 26 * 60 * 60 * 1000);
  }
  const cancelled = bLessons.find((l) => l.startsAt!.getTime() > today.getTime() + 3 * DAY_MS && l.disciplineId === discId.worldec && l.type === "seminar");
  if (cancelled) {
    cancelled.status = "cancelled";
    cancelled.changeNote = "Занятие отменено, материал — в электронном курсе";
    cancelled.changedAt = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  }
  for (let w = 1; w <= 7; w++) {
    const weekFrom = addDays(weekStart, w * 7).getTime();
    const l = bLessons.find((x) => x.startsAt!.getTime() >= weekFrom && x.status === undefined && x.type === "seminar" && x.disciplineId === discId.prob);
    if (l) {
      l.originalStartsAt = l.startsAt;
      l.startsAt = mskAt(l.startsAt!, SLOTS[4][0], SLOTS[4][1]);
      l.endsAt = new Date(l.startsAt.getTime() + 80 * 60 * 1000);
      l.status = "moved";
      l.changeNote = "Семинар перенесён по просьбе кафедры";
      l.changedAt = new Date(weekFrom - 3 * DAY_MS);
    }
  }
  // У Соколовой одна смена аудитории в ближайшие дни.
  const aChange = fromToday(GROUP_A).find((l) => l.type === "seminar" && l.startsAt!.getTime() > now.getTime());
  if (aChange) {
    aChange.originalRoom = aChange.room;
    aChange.room = "ауд. 1107";
    aChange.status = "room_changed";
    aChange.changeNote = "Аудитория занята под олимпиаду";
    aChange.changedAt = new Date(now.getTime() - 20 * 60 * 60 * 1000);
  }
  for (let i = 0; i < lessons.length; i += 200) await db.insert(s.lesson).values(lessons.slice(i, i + 200));

  /* ── Заявки ── */
  let num = 1001;
  async function addRequest(
    studentId: string,
    type: string,
    payload: Record<string, string>,
    history: { status: (typeof s.requestStatusEnum.enumValues)[number]; daysAgo: number; actor: "student" | "staff"; comment?: string }[],
    extra: Partial<typeof s.request.$inferInsert> = {},
  ) {
    const id = randomUUID();
    const last = history[history.length - 1];
    const touchedByStaff = history.some((h) => h.actor === "staff");
    await db.insert(s.request).values({
      assigneeName: touchedByStaff ? STAFF_NAME : null,
      id,
      number: `${now.getFullYear()}-${String(num++).padStart(5, "0")}`,
      studentId,
      type,
      status: last.status,
      payload,
      createdAt: addDays(now, -history[0].daysAgo),
      updatedAt: addDays(now, -last.daysAgo),
      ...extra,
    });
    await db.insert(s.requestEvent).values(
      history.map((h) => ({ requestId: id, status: h.status, actor: h.actor, comment: h.comment ?? null, createdAt: addDays(now, -h.daysAgo) })),
    );
    return id;
  }

  const readyComment = "Справка готова. Электронная версия с подписью отправлена на почту, бумажную можно забрать в учебном офисе, каб. 1107, пн–пт 10:00–17:00";
  await addRequest(studentA, "study_certificate", { purpose: "Отдел социальной защиты населения", copies: "2", format: "Бумажная в учебном офисе" }, [
    { status: "submitted", daysAgo: 3, actor: "student" },
    { status: "in_progress", daysAgo: 2, actor: "staff" },
    { status: "ready", daysAgo: 0.6, actor: "staff", comment: readyComment },
  ], { staffComment: readyComment });
  await addRequest(studentA, "transcript", { language: "Английский", purpose: "Летняя школа по экономике" }, [
    { status: "submitted", daysAgo: 34, actor: "student" },
    { status: "in_progress", daysAgo: 33, actor: "staff" },
    { status: "ready", daysAgo: 30, actor: "staff" },
    { status: "done", daysAgo: 28, actor: "staff" },
  ]);

  const returnReason = "В заявке пропуск только 10 ноября, а справка из поликлиники — на 10–12 ноября. Исправьте дату окончания, чтобы закрыть все пропуски.";
  const d10 = addDays(today, -7);
  const ymd = (d: Date) => new Date(d.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10);
  await addRequest(studentB, "absence_excuse", { dateFrom: ymd(d10), dateTo: ymd(d10), reason: "Болезнь", comment: "Пропустил эконометрику и французский" }, [
    { status: "submitted", daysAgo: 4, actor: "student" },
    { status: "returned", daysAgo: 1, actor: "staff", comment: returnReason },
  ], { returnReason, returnField: "dateTo" });
  await addRequest(studentB, "military_certificate", { commissariat: "Военный комиссариат Гагаринского района", format: "Бумажная в учебном офисе" }, [
    { status: "submitted", daysAgo: 2, actor: "student" },
    { status: "in_progress", daysAgo: 1, actor: "staff" },
  ]);

  // Заявки однокурсников — для живой очереди методиста.
  const others = await db.query.student.findMany({ where: (t, { isNull }) => isNull(t.userId), limit: 5 });
  const otherReqs: [string, Record<string, string>, (typeof s.requestStatusEnum.enumValues)[number]][] = [
    ["study_certificate", { purpose: "Банк, оформление кредитной карты", copies: "1", format: "Электронная с электронной подписью" }, "submitted"],
    ["transcript", { language: "Английский", purpose: "Программа обмена" }, "submitted"],
    ["absence_excuse", { dateFrom: ymd(addDays(today, -3)), dateTo: ymd(addDays(today, -2)), reason: "Участие в мероприятии от вуза", comment: "Модель ООН" }, "in_progress"],
    ["study_certificate", { purpose: "Пенсионный фонд (СФР)", copies: "1", format: "Бумажная в учебном офисе" }, "ready"],
    ["consultation", { discipline: "Эконометрика", slot: "Будни после 14:00", question: "Разобрать задачи на гетероскедастичность" }, "submitted"],
  ];
  for (let i = 0; i < others.length && i < otherReqs.length; i++) {
    const [type, payload, status] = otherReqs[i];
    const hist: { status: typeof status; daysAgo: number; actor: "student" | "staff" }[] = [{ status: "submitted", daysAgo: 1 + i * 0.4, actor: "student" }];
    if (status !== "submitted") hist.push({ status: "in_progress", daysAgo: 0.5 + i * 0.1, actor: "staff" });
    if (status === "ready") hist.push({ status: "ready", daysAgo: 0.2, actor: "staff" });
    await addRequest(others[i].id, type, payload, hist);
  }

  /* ── Уведомления ── */
  const n = (studentId: string, v: Omit<typeof s.notification.$inferInsert, "studentId">) => ({ studentId, ...v });
  await db.insert(s.notification).values([
    n(studentA, { kind: "request", title: "Готово: Справка об обучении", body: readyComment, link: "/requests", createdAt: addDays(now, -0.6) }),
    n(studentA, { kind: "deadline", title: "Выбор темы курсовой работы", body: "Согласуйте тему с научным руководителем и отметьте её в кабинете.", dueAt: mskAt(addDays(today, 8), 18), createdAt: addDays(now, -2) }),
    n(studentA, { kind: "schedule", title: "Смена аудитории", body: "Семинар пройдёт в ауд. 1107: аудитория занята под олимпиаду.", link: "/schedule", createdAt: addDays(now, -0.8) }),
    n(studentA, { kind: "grade", title: "Выставлены баллы за 2-й срез", body: "Эконометрика: 88 из 100.", link: "/grades", createdAt: addDays(now, -6), readAt: addDays(now, -5) }),
    n(studentB, { kind: "schedule", title: "Перенос семинара по эконометрике", body: "Преподаватель на конференции, семинар перенесён на вечер.", link: "/schedule", createdAt: new Date(now.getTime() - 2 * 3600 * 1000) }),
    n(studentB, { kind: "retake", title: "Пересдача 2: Макроэкономика", body: "Пересдача назначена, ауд. 2034. Это последняя попытка перед комиссией.", link: "/rating", dueAt: mskAt(addDays(today, 9), 11), createdAt: addDays(now, -3) }),
    n(studentB, { kind: "request", title: "Нужны уточнения: Пропуск по уважительной причине", body: returnReason, link: "/requests", createdAt: addDays(now, -1) }),
    n(studentB, { kind: "deadline", title: "Заявление на пересдачу", body: "Подайте заявление на пересдачу по макроэкономике, чтобы попасть в ведомость.", link: "/requests/new?type=retake_application", dueAt: mskAt(addDays(today, 5), 18), createdAt: addDays(now, -3) }),
    n(studentB, { kind: "deadline", title: "Выбор темы курсовой работы", body: "Согласуйте тему с научным руководителем и отметьте её в кабинете.", dueAt: mskAt(addDays(today, 8), 18), createdAt: addDays(now, -2), readAt: addDays(now, -1) }),
  ]);

  await db.insert(s.news).values([
    { title: "Опубликовано расписание зимней сессии", body: "Экзамены начнутся через пять недель. Расписание уже в разделе «Учёба» и в календаре.", important: true, publishedAt: addDays(now, -1) },
    { title: "Запись на третий иностранный язык", body: "Студенты с рейтингом от 75 могут подать заявку на третий язык до конца месяца. Условия — в разделе «Рейтинг».", faculty: FACULTY, publishedAt: addDays(now, -3) },
    { title: "Учебный офис: часы приёма", body: "Учебный офис принимает студентов пн–пт с 10:00 до 17:00, перерыв 13:00–14:00. Справки можно заказать онлайн в разделе «Заявки».", publishedAt: addDays(now, -6) },
    { title: "Стипендиальная комиссия", body: "Комиссия рассмотрит заявления на повышенную стипендию после зимней сессии. Следите за рейтингом.", faculty: FACULTY, publishedAt: addDays(now, -9) },
  ]);

  return { studentA, studentB };
}
