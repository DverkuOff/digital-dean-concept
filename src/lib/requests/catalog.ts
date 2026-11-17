// Каталог заявок и справок. Общий для клиента и сервера: только описания, без доступа к БД.
// Перечень собран по открытым данным ВШЭ, МИСИС, РАНХиГС (docs/research/03-domain.md §3).

export type FieldDef =
  | { name: string; label: string; kind: "text"; required?: boolean; placeholder?: string; maxLength?: number }
  | { name: string; label: string; kind: "textarea"; required?: boolean; placeholder?: string; maxLength?: number }
  | { name: string; label: string; kind: "date"; required?: boolean }
  | { name: string; label: string; kind: "number"; required?: boolean; min: number; max: number }
  | { name: string; label: string; kind: "select"; required?: boolean; options: string[] };

export type RequestTypeDef = {
  key: string;
  title: string;
  description: string;
  eta: string; // ориентировочный срок
  typicalDays: number; // обычно готовят за N рабочих дней (по данным очереди; в концепте — условно)
  icon: "file" | "shield" | "calendar" | "languages" | "refresh" | "messages";
  fields: FieldDef[];
  note?: string;
};

const FORMAT_FIELD: FieldDef = {
  name: "format",
  label: "Формат",
  kind: "select",
  required: true,
  options: ["Электронная с электронной подписью", "Бумажная в учебном офисе"],
};

export const REQUEST_TYPES: RequestTypeDef[] = [
  {
    key: "study_certificate",
    typicalDays: 2,
    title: "Справка об обучении",
    description: "По месту требования: соцзащита, СФР, работа родителей, банк, налоговый вычет.",
    eta: "до 3 рабочих дней",
    icon: "file",
    fields: [
      { name: "purpose", label: "Куда предоставляется", kind: "text", required: true, placeholder: "Например, отдел соцзащиты", maxLength: 200 },
      { name: "copies", label: "Количество экземпляров", kind: "number", required: true, min: 1, max: 5 },
      FORMAT_FIELD,
    ],
  },
  {
    key: "military_certificate",
    typicalDays: 3,
    title: "Справка для военкомата",
    description: "Для отсрочки и воинского учёта (форма по приложению к приказу).",
    eta: "до 5 рабочих дней",
    icon: "shield",
    fields: [
      { name: "commissariat", label: "Военный комиссариат", kind: "text", required: true, placeholder: "Например, ВК района Тропарёво-Никулино", maxLength: 200 },
      FORMAT_FIELD,
    ],
  },
  {
    key: "absence_excuse",
    typicalDays: 2,
    title: "Уважительная причина пропуска",
    description: "Закрыть пропуски и сохранить допуск к сессии.",
    eta: "до 3 рабочих дней",
    icon: "calendar",
    fields: [
      { name: "dateFrom", label: "Пропуск с", kind: "date", required: true },
      { name: "dateTo", label: "Пропуск по", kind: "date", required: true },
      {
        name: "reason",
        label: "Причина",
        kind: "select",
        required: true,
        options: ["Болезнь", "Семейные обстоятельства", "Участие в мероприятии от вуза", "Другое"],
      },
      { name: "comment", label: "Комментарий", kind: "textarea", placeholder: "Какие занятия пропущены, что приложите в учебном офисе", maxLength: 1000 },
    ],
    note: "В концепте документы не загружаются: медицинские справки — это персональные данные особой категории.",
  },
  {
    key: "transcript",
    typicalDays: 4,
    title: "Выписка оценок (транскрипт)",
    description: "Для стажировки, обмена или работы. На русском или английском.",
    eta: "до 5 рабочих дней",
    icon: "languages",
    fields: [
      { name: "language", label: "Язык", kind: "select", required: true, options: ["Русский", "Английский"] },
      { name: "purpose", label: "Для чего", kind: "text", required: true, placeholder: "Например, программа обмена", maxLength: 200 },
    ],
  },
  {
    key: "retake_application",
    typicalDays: 1,
    title: "Заявление на пересдачу",
    description: "Записаться на пересдачу или попросить индивидуальный график сдачи.",
    eta: "до 2 рабочих дней",
    icon: "refresh",
    fields: [
      { name: "discipline", label: "Дисциплина", kind: "text", required: true, maxLength: 200 },
      {
        name: "variant",
        label: "Что нужно",
        kind: "select",
        required: true,
        options: ["Записаться на ближайшую пересдачу", "Индивидуальный график сдачи"],
      },
      { name: "reason", label: "Пояснение", kind: "textarea", maxLength: 1000 },
    ],
  },
  {
    key: "consultation",
    typicalDays: 1,
    title: "Консультация перед пересдачей",
    description: "Запись на консультацию к преподавателю через учебный офис.",
    eta: "ответ в течение 1 рабочего дня",
    icon: "messages",
    fields: [
      { name: "discipline", label: "Дисциплина", kind: "text", required: true, maxLength: 200 },
      {
        name: "slot",
        label: "Удобное время",
        kind: "select",
        required: true,
        options: ["Будни до 14:00", "Будни после 14:00", "Суббота"],
      },
      { name: "question", label: "Что хотите разобрать", kind: "textarea", maxLength: 1000 },
    ],
  },
];

export function getRequestType(key: string): RequestTypeDef | undefined {
  return REQUEST_TYPES.find((t) => t.key === key);
}

/** Одно название заявки везде: в каталоге, уведомлениях и карточках. В середине фразы — со строчной. */
export function requestName(def: RequestTypeDef | undefined, inSentence = false): string {
  const t = def?.title ?? "Заявка";
  return inSentence ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

export type RequestStatus = "submitted" | "in_progress" | "returned" | "ready" | "done" | "rejected";

export const STATUS_META: Record<RequestStatus, { label: string; tone: "info" | "progress" | "warning" | "success" | "muted" | "danger"; hint: string }> = {
  submitted: { label: "Подана", tone: "info", hint: "Ждёт, пока методист возьмёт её в работу" },
  in_progress: { label: "В работе", tone: "progress", hint: "Методист готовит документ" },
  returned: { label: "Нужно исправить", tone: "warning", hint: "Исправьте отмеченное поле и подайте снова" },
  ready: { label: "Готова", tone: "success", hint: "Документ готов, где забрать — ниже" },
  done: { label: "Выдана", tone: "muted", hint: "Заявка закрыта" },
  rejected: { label: "Отклонена", tone: "danger", hint: "Причина — в истории ниже" },
};

/** Переходы, которые может сделать методист. Проверяются на сервере. */
export const STAFF_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  submitted: ["in_progress", "returned", "rejected"],
  in_progress: ["ready", "returned", "rejected"],
  returned: [],
  ready: ["done"],
  done: [],
  rejected: [],
};

export const STAFF_ACTION_LABEL: Partial<Record<RequestStatus, string>> = {
  in_progress: "Взять в работу",
  ready: "Готово",
  done: "Выдана",
  returned: "Вернуть с причиной",
  rejected: "Отклонить",
};

/** Статусы, для которых методист обязан написать комментарий. */
export const COMMENT_REQUIRED: RequestStatus[] = ["returned", "rejected"];

/** Порядок шагов таймлайна «как посылка». */
export const TIMELINE_STEPS: RequestStatus[] = ["submitted", "in_progress", "ready", "done"];

/** Значение поля заявки для показа: даты — «дд.мм.гггг». */
export function displayFieldValue(f: FieldDef, value: string): string {
  if (f.kind === "date") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : value;
  }
  return value;
}
