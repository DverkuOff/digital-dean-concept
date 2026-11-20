# AGENTS.md — правила для ИИ-ассистентов в коде «Ориентира»

Этот файл читают Claude Code (через CLAUDE.md), Codex, Cursor и другие агенты. Процесс хакатона — в CLAUDE.md, требования — в docs/00-brief.md, план — в docs/plan.md.

## Что это
Веб-прототип личного кабинета студента «Ориентир» (кейс «Цифровой деканат будущего»). Next.js 16 App Router + TypeScript, Drizzle + PostgreSQL, Better Auth (логин+пароль, argon2id), Tailwind 4 + shadcn/ui (radix), Playwright, Vitest.

## Карта кода
| Где | Что |
|---|---|
| `src/app/(student)/*` | Экраны студента: today, schedule, grades, rating, requests, notifications, profile. Роль проверяется в `(student)/layout.tsx` |
| `src/app/staff/*` | Очередь методиста одной страницей. Роль — в `staff/layout.tsx` |
| `src/server/session.ts` | `requireStudent` / `requireStaff` для страниц, `studentForAction` / `staffForAction` для actions |
| `src/server/dal/*` | **Единственное** место чтения данных студента. Каждый запрос с фильтром по владельцу из сессии |
| `src/server/actions/*` | Server Actions. Это публичные POST-эндпоинты |
| `src/lib/rating/*` | Рейтинг: чистые функции + конфиг правил. Спека docs/specs/rating.md |
| `src/lib/today/rules.ts` | Правила карточек «Сегодня». Спека docs/specs/today.md |
| `src/lib/requests/*` | Каталог заявок, статусы, переходы, обычные сроки, валидация полей |
| `src/lib/calendar/ics.ts` + `src/app/api/calendar/[token]` | Подписка на расписание (.ics) по секретному токену; в БД только хеш |
| `src/lib/search/match.ts` + `src/server/actions/search.ts` | Глобальный поиск Ctrl+K только по своим данным |
| `public/sw.js` + `src/components/app/pwa.tsx` | PWA: офлайн для трёх страниц, кэш раздельный по пользователю, стирается при выходе. Спека docs/specs/pwa.md |
| `src/components/app/theme.tsx` | Тёмная тема: скрипт в `<head>` + переключатель в профиле |
| `scripts/seed.ts` + `scripts/seed-calendar.ts` | Вымышленные демо-данные, все даты от `now`; праздники, дни экзаменов, время событий — чистые функции с тестом |
| `src/lib/schedule/nav.ts` | Параметры расписания (?d/?w/?m, зажатые в пределы) и ссылки вкладок День/Неделя/Месяц |
| `e2e/*` | Playwright: безопасность, сквозной путь брифа, рейтинг, «Сегодня», 360 px |

## Жёсткие правила
1. **Доступ к данным только через DAL.** Владелец — в `WHERE` того же запроса (`and(eq(x.id, id), eq(x.studentId, me.id))`). Не нашли → `notFound()`. Подробно: docs/specs/access-control.md.
2. **Server Actions проверяют сессию, роль и владельца сами.** `studentId`/`role` никогда не берутся из формы или URL. Ввод — через zod или `validatePayload`.
3. **Не ставить `loading.tsx` над страницей, которая вызывает `notFound()`** для чужих данных: при стриминге статус станет 200 вместо 404.
4. **Только вымышленные данные.** Никаких реальных ФИО, логотипов вуза и госсимволики. Плашка «Концепт для конкурса…» на каждой странице (root layout).
5. **Секреты только в `.env`**, имена — в `.env.example`. Никаких `NEXT_PUBLIC_*` с ключами. `.env` не читать.
6. **Не кэшировать персональные страницы, кроме трёх в `sw.js`.** Новый офлайн-раздел — только через спеку docs/specs/pwa.md и тест очистки кэша при выходе.
7. **Доступ без сессии (календарь) — только по случайному токену, в БД только хеш.**
8. **Даты в сиде — относительно `now`**, время — московское (`src/lib/dates.ts`).
9. **Правила вуза (пороги, формула, попытки) — в конфиге**, на экране помечены как условные.
10. **Мобильная вёрстка 360 px**: без горизонтальной прокрутки, кнопки от 40 px, нижний таббар.
11. Тексты интерфейса и документов — по-русски.
12. Что не сделано по-настоящему — пометка `MOCK` в коде и README.

## Перед коммитом
```bash
npm run typecheck && npm run lint && npm test && npm run build
npm run test:e2e        # база сбрасывается в демо-состояние
```
После изменения зависимостей — чистая установка (`rm -rf node_modules package-lock.json && npm install`): иначе npm теряет нативные бинарники (docs/decisions.md).
Коммиты маленькие, по-русски, от имени автора репозитория, без служебных трейлеров соавторства. Работа с ИИ описана открыто в `docs/process/`.
Перед коммитом фичи, которая читает или пишет данные студента, — агент `access-reviewer` (`.claude/agents/`).

## Как ставить задачу агенту в этом репо
Указать: экран или модуль, ссылку на спеку в docs/specs/, критерий готовности (какой тест должен пройти). Новая бизнес-логика — сначала чистая функция с юнит-тестом в `src/lib`, потом DAL, потом экран.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
