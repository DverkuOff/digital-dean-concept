// Схема БД. Описание сущностей и правил доступа: docs/specs/data-model.md.
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/* ───────────── Better Auth (user, session, account, verification) ───────────── */

export const roleEnum = pgEnum("role", ["student", "staff"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  role: roleEnum("role").default("student").notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: ts("created_at").defaultNow().notNull(),
    updatedAt: ts("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: ts("created_at").defaultNow().notNull(),
    updatedAt: ts("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").defaultNow().notNull(),
    updatedAt: ts("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* ───────────── Предметная область ───────────── */

// Студент. user_id есть только у демо-аккаунтов; ~60 однокурсников без входа
// нужны лишь для агрегата «место на курсе» и наружу не отдаются.
export const student = pgTable(
  "student",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    lastName: text("last_name").notNull(),
    firstName: text("first_name").notNull(),
    middleName: text("middle_name"),
    faculty: text("faculty").notNull(),
    program: text("program").notNull(),
    course: integer("course").notNull(),
    groupCode: text("group_code").notNull(),
    cohort: text("cohort").notNull(), // поток для места на курсе, например «МЭО-2025»
    fundingType: text("funding_type").notNull().default("бюджет"),
    recordBook: text("record_book").notNull(), // номер зачётки (вымышленный)
  },
  (t) => [index("student_cohort_idx").on(t.cohort), index("student_group_idx").on(t.groupCode)],
);

export const controlTypeEnum = pgEnum("control_type", ["exam", "diff_credit", "credit"]);

export const discipline = pgTable("discipline", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  credits: real("credits").notNull(), // ЗЕТ, вес в рейтинге
  controlType: controlTypeEnum("control_type").notNull(),
  semester: integer("semester").notNull(),
  teacher: text("teacher").notNull(),
});

// Результат студента по дисциплине в семестре.
// final_score = null — дисциплина не закрыта (сессия впереди).
export const gradeStatusEnum = pgEnum("grade_status", ["open", "passed", "debt"]);

export const grade = pgTable(
  "grade",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    disciplineId: uuid("discipline_id")
      .notNull()
      .references(() => discipline.id, { onDelete: "cascade" }),
    // срезы текущего контроля, каждый 0–100
    slice1: integer("slice1"),
    slice2: integer("slice2"),
    slice3: integer("slice3"),
    finalScore: integer("final_score"),
    status: gradeStatusEnum("status").notNull(),
    passedOnRetake: boolean("passed_on_retake").notNull().default(false),
    updatedAt: ts("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("grade_student_idx").on(t.studentId),
    uniqueIndex("grade_student_discipline_uq").on(t.studentId, t.disciplineId),
  ],
);

// Попытки сдачи по долгу: основная, пересдача 1, пересдача 2, комиссия.
export const attemptKindEnum = pgEnum("attempt_kind", ["main", "retake1", "retake2", "commission"]);
export const attemptResultEnum = pgEnum("attempt_result", ["failed", "passed", "scheduled", "absent"]);

export const examAttempt = pgTable(
  "exam_attempt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    disciplineId: uuid("discipline_id")
      .notNull()
      .references(() => discipline.id, { onDelete: "cascade" }),
    kind: attemptKindEnum("kind").notNull(),
    scheduledAt: ts("scheduled_at"),
    room: text("room"),
    score: integer("score"),
    result: attemptResultEnum("result").notNull(),
  },
  (t) => [index("attempt_student_idx").on(t.studentId)],
);

// Занятие. Принадлежит группе; студент видит пары только своей группы.
export const lessonStatusEnum = pgEnum("lesson_status", ["normal", "moved", "room_changed", "cancelled"]);
export const lessonTypeEnum = pgEnum("lesson_type", ["lecture", "seminar", "language"]);

export const lesson = pgTable(
  "lesson",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupCode: text("group_code").notNull(),
    disciplineId: uuid("discipline_id")
      .notNull()
      .references(() => discipline.id, { onDelete: "cascade" }),
    type: lessonTypeEnum("type").notNull(),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    room: text("room").notNull(),
    teacher: text("teacher").notNull(),
    status: lessonStatusEnum("status").notNull().default("normal"),
    originalStartsAt: ts("original_starts_at"),
    originalRoom: text("original_room"),
    changeNote: text("change_note"),
    changedAt: ts("changed_at"),
  },
  (t) => [index("lesson_group_time_idx").on(t.groupCode, t.startsAt)],
);

// Личная заметка студента к паре («принести эссе»). Видна только автору.
export const lessonNote = pgTable(
  "lesson_note",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lesson.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    updatedAt: ts("updated_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.lessonId] })],
);

/* ───────────── Заявки ───────────── */

export const requestStatusEnum = pgEnum("request_status", [
  "submitted",
  "in_progress",
  "returned",
  "ready",
  "done",
  "rejected",
]);

// Номер заявки для людей. Sequence вместо count(*)+1: при одновременной подаче count давал
// одинаковые номера и 500 (находка аудита М2: из 20 параллельных подач 11 падали).
export const requestNumberSeq = pgSequence("request_number_seq", { startWith: 1001 });

export const request = pgTable(
  "request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull().unique(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // ключ из src/lib/requests/catalog.ts
    status: requestStatusEnum("status").notNull().default("submitted"),
    payload: jsonb("payload").$type<Record<string, string>>().notNull(),
    returnReason: text("return_reason"),
    returnField: text("return_field"),
    staffComment: text("staff_comment"),
    // Кто ведёт заявку: имя методиста, взявшего её в работу (для прозрачности студенту).
    assigneeName: text("assignee_name"),
    createdAt: ts("created_at").defaultNow().notNull(),
    updatedAt: ts("updated_at").defaultNow().notNull(),
  },
  (t) => [index("request_student_idx").on(t.studentId), index("request_status_idx").on(t.status)],
);

export const requestEvent = pgTable(
  "request_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => request.id, { onDelete: "cascade" }),
    status: requestStatusEnum("status").notNull(),
    comment: text("comment"),
    actor: text("actor").notNull(), // "student" | "staff"
    createdAt: ts("created_at").defaultNow().notNull(),
  },
  (t) => [index("request_event_request_idx").on(t.requestId)],
);

/* ───────────── Уведомления ───────────── */

// Новости деканата: общие для всех (faculty = null) или для факультета.
export const news = pgTable("news", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  faculty: text("faculty"),
  important: boolean("important").notNull().default(false),
  publishedAt: ts("published_at").notNull(),
});

export const notificationKindEnum = pgEnum("notification_kind", [
  "schedule",
  "deadline",
  "request",
  "retake",
  "grade",
]);

// Персональные уведомления студента.
export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    kind: notificationKindEnum("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    dueAt: ts("due_at"),
    createdAt: ts("created_at").defaultNow().notNull(),
    readAt: ts("read_at"),
  },
  (t) => [index("notification_student_idx").on(t.studentId)],
);

// Скрытые карточки «Сегодня» (кнопка «понял»).
export const dismissedCard = pgTable(
  "dismissed_card",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    cardKey: text("card_key").notNull(),
    dismissedAt: ts("dismissed_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.cardKey] })],
);

/* ───────────── Подписка на расписание (.ics) ───────────── */

// Личная ссылка на календарь. Храним только SHA-256 токена: сам токен видит лишь студент
// в момент выпуска. Перевыпуск заменяет хеш — старая ссылка сразу перестаёт работать.
export const calendarToken = pgTable("calendar_token", {
  studentId: uuid("student_id")
    .primaryKey()
    .references(() => student.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: ts("created_at").defaultNow().notNull(),
  lastUsedAt: ts("last_used_at"),
});

/* ───────────── Связи ───────────── */

export const studentRelations = relations(student, ({ one, many }) => ({
  user: one(user, { fields: [student.userId], references: [user.id] }),
  grades: many(grade),
  requests: many(request),
}));

export const gradeRelations = relations(grade, ({ one }) => ({
  student: one(student, { fields: [grade.studentId], references: [student.id] }),
  discipline: one(discipline, { fields: [grade.disciplineId], references: [discipline.id] }),
}));

export const requestRelations = relations(request, ({ one, many }) => ({
  student: one(student, { fields: [request.studentId], references: [student.id] }),
  events: many(requestEvent),
}));

export const requestEventRelations = relations(requestEvent, ({ one }) => ({
  request: one(request, { fields: [requestEvent.requestId], references: [request.id] }),
}));
