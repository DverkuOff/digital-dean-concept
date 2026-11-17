# 04. Технологии: стек, хостинг из РФ, безопасность, UI, ИИ

Трек 2 «Цифровой деканат будущего». Дата ресёрча: 11.11.2026. Режим: глубоко (15 поисков, 10 страниц).
Пометки: [вывод] — наш вывод, [не проверено] — без открытой страницы или из общих знаний, «по сниппету» — факт из выдачи поиска.

## TL;DR

1. **Блокер: зарубежный хостинг из РФ ненадёжен.** Vercel в 2026 году открывается из России через раз, в зависимости от IP входной точки (жалобы в январе, апреле, мае и сентябре 2026). Cloudflare с 9.06.2025 урезается российскими провайдерами до 16 КБ на запрос. Для нас это значит: Vercel, Cloudflare Pages и Workers для сдачи не берём, деплоим на российский PaaS.
2. **Хостинг по умолчанию: Amvera, запасной вариант Timeweb Cloud Apps.** Amvera даёт деплой через git push, оплату рублями, серверы в РФ, 111 ₽ на старт и managed-СУБД от 170 ₽/мес. Timeweb Cloud Apps собирает Next.js с SSR из GitHub, тарифы от 1 ₽. До 28.11 это стоит порядка 300–700 ₽ [вывод]. Yandex Serverless Containers по free tier бесплатен, но там холодный старт и нет бесплатного Postgres.
3. **Стек по умолчанию: Next.js 16 (App Router) + TypeScript + Drizzle + PostgreSQL + Better Auth + shadcn/ui.** Одним человеком с Claude Code это собирается быстрее всего, и жюри поверит, что стек «способен масштабироваться». Lucia снята с поддержки в марте 2025, Auth.js с сентября 2025 ведёт команда Better Auth. Брать Better Auth.
4. **Безопасность показываем, а не только заявляем.** Владельца проверяем в слое доступа к данным: каждый запрос содержит `WHERE owner_id = session.userId`, а Server Actions считаются публичными эндпоинтами. Пароли хешируем argon2id. Ключи храним в env хостинга. Для жюри пишем Playwright-тест «студент А открывает заявку студента Б и получает 404» и показываем скриншот или видео.
5. **ИИ-ассистент в кабинете бесплатен и доступен из РФ: GigaChat API.** Физлицо получает freemium на 365 млн токенов на 12 месяцев (Lite 250 млн), генерация в один поток. Запасной вариант: YandexGPT Lite или Alice AI в Yandex AI Studio, это копейки за 1 тыс. токенов. Вызовы делаем только из Route Handler на сервере.

## 1. Стек: варианты под вайб-кодинг одним человеком

| Вариант | Плюсы для нас | Минусы | Вердикт |
|---|---|---|---|
| **Next.js 16 (App Router) + Drizzle + Postgres + Better Auth** | Один репозиторий и один язык (TS). Server Components и Server Actions убирают отдельный API. Claude Code лучше всего знает этот стек. shadcn/ui нативен. Линия 16.x в Active LTS ([nextjs.org/support-policy](https://nextjs.org/support-policy)) | Нужен Node-сервер (не статика). Server Actions легко сделать дырявыми (см. §3) | **Рекомендуем** |
| Next.js + SQLite (better-sqlite3/libSQL) | Ноль внешних зависимостей, база — файл | Нужен постоянный диск на хостинге. Тезис «масштабируется» слабее. Drizzle позволяет потом перейти на Postgres | Запасной, если managed Postgres не заведётся |
| SvelteKit + Drizzle + Postgres | Меньше бойлерплейта, быстрый UI | Экосистема UI-китов меньше (shadcn-svelte — порт). У ИИ меньше примеров | Только если команда уже знает Svelte |
| FastAPI + React (Vite) | Python-бэкенд, Pydantic, удобно для ИИ-функций | Две кодовые базы, CORS, два деплоя. Сессии и CSRF придётся собирать руками | Не для одного человека за 11 дней [вывод] |
| Django + HTMX/шаблоны | Готовые auth (хеши паролей) и админка, из которой бесплатно получается «кабинет сотрудника деканата» | Современный мобильный UI на шаблонах дороже. Слабее по критерию «Качество» | Альтернатива, если нужен сильный кабинет сотрудника |

Версии: актуальная мажорная версия Next.js 16.x. Последний стабильный релиз по агрегаторам 16.2.10 (07.2026) или 16.4.1 (10.2026), источники расходятся, ставим `next@latest` (по сниппету, [versionlog](https://versionlog.com/nextjs/16/), 2026).

### Библиотека аутентификации

| Библиотека | Статус на 11.2026 | Для нас |
|---|---|---|
| **Better Auth** | Рекомендуют для новых проектов. 07.07.2026 куплена Vercel ([блог](https://better-auth.com/blog/better-auth-joins-vercel), 2026). Email и пароль, сессии в БД, адаптер Drizzle | **Берём.** Хеш по умолчанию scrypt [не проверено]. Для формулировки жюри «argon2» переопределяем `password.hash/verify` через `@node-rs/argon2` |
| Auth.js (NextAuth) v5 | С сентября 2025 поддерживается командой Better Auth ([блог](https://better-auth.com/blog/authjs-joins-better-auth), 2025). v5 всё ещё beta. Credentials-провайдер исторически неудобен | Не берём |
| Lucia | «Lucia was deprecated in March 2025». Теперь это учебный ресурс и однофайловый `auth_session.ts` ([lucia-auth.com](https://lucia-auth.com/), страница 07.2026) | Годится как образец своих сессий, если хотим ~150 строк своего кода, который легко объяснить жюри |
| Clerk, Supabase Auth, Auth0 | Внешние SaaS, оплата и доступность из РФ под вопросом | Не берём: зависимость от зарубежного сервиса |

## 2. Хостинг и БД: что открывается из РФ без VPN

### Зарубежные платформы

| Платформа | Доступность из РФ (2025–2026) | Оплата из РФ | Вердикт |
|---|---|---|---|
| Vercel | Нестабильно. С 01.2026 на форуме Vercel жалобы, что сайты не открываются из России. 26.09.2026: `*.vercel.app` из Мурманска даёт ERR_CONNECTION_RESET, часть IP (216.198.79.67, 64.29.17.67) не проходит TLS или TCP, другие (76.76.21.21) отвечают 200. Официального ответа нет ([тема](https://community.vercel.com/t/regional-access-to-vercel-app-varies-by-ingress-ip-from-russia/49777), 2026) | Hobby бесплатен без карты [не проверено] | **Нет**: жюри может не открыть |
| Cloudflare Pages/Workers | С 9.06.2025 Ростелеком, МегаФон, Билайн, МТС и МГТС режут трафик к Cloudflare до 16 КБ на запрос, «большинство сайтов почти не работает» ([The Record](https://therecord.media/cloudflare-russia-restricting-access-crackdown), 2025). В 08.2026 ещё и проблемы с DoH Cloudflare (по сниппету, [digitalbusiness.kz](https://digitalbusiness.kz/2026-08-25/v-rossii-nachali-blokirovat-zashchishchennie-servisi-google-i-cloudflare/), 2026) | — | **Нет** |
| Netlify, Render, Fly.io | Прямых данных о блокировке в 2026 **не найдено**. В 06.2025 на ntc.party обсуждали блокировки Hetzner, DigitalOcean и OVH (слабый источник). Все они на зарубежных IP, и риск у них тот же, что у Vercel [вывод] | Render и Fly требуют карту для платного, у Fly нет free tier для новых [не проверено] | **Нет** |
| Supabase (БД/auth) | Блокировки в Индии и ОАЭ в 2026, по РФ данных нет ([блог Supabase](https://supabase.com/blog/navigating-regional-network-blocks), 2026). Оплата из РФ только через посредников (по сниппету, dtf.ru) | Проблемно | **Нет** |

### Российские платформы

| Платформа | Что даёт | Цена | Риски |
|---|---|---|---|
| **Amvera** | PaaS с git push, нативный Node.js и Docker, Next.js с SSR ([Хабр](https://habr.com/ru/companies/amvera/articles/819085), 2024). Managed PostgreSQL, Redis, MySQL «от 170 ₽/мес». Трафик к API OpenAI и Anthropic бесплатно проксируется через зарубежный IP ([amvera.ru](https://amvera.ru/), 2026) | 111 ₽ при регистрации. Тарифы (агрегатор, по сниппету): Пробный 170 ₽ (0,1 ГБ RAM, для Next.js мало), Начальный 290 ₽, Начальный Плюс 490 ₽ ([toolfox](https://toolfox.ru/services/s/amvera), 2026) | Next.js на 0,1 ГБ не поднимется, нужен тариф от «Начального» [вывод]. Точные лимиты RAM сверить в кабинете |
| **Timeweb Cloud Apps** | Next.js (SSR), Nuxt, React, Svelte, Vue, Node.js (npm, yarn, pnpm), Dockerfile. Деплой из GitHub, GitLab, Bitbucket или по URL репозитория. Бесплатный SSL ([timeweb.cloud/services/apps](https://timeweb.cloud/services/apps), 2026) | «От 1 ₽» (так на сайте, это фронтенд-статика). Бэкенд-тарифы на странице не указаны. Сторонний агрегатор: от 400 ₽/мес ([subger](https://subger.com/en/service/timeweb-ru), по сниппету) | GitVerse не указан, нужен GitHub. Postgres (DBaaS) отдельно. Цены сверить |
| **Yandex Cloud Serverless Containers** | Free tier в месяц: 1 млн вызовов, 10 ГБ×ч RAM, 5 vCPU×ч. YDB: 1 млн RU и 1 ГБ. Object Storage: 1 ГБ. Неиспользованное сгорает ([docs](https://yandex.cloud/ru/docs/billing/concepts/serverless-free-tier), обновлено 09.11.2026) | Бесплатно в пределах free tier. Нужен платёжный аккаунт с картой РФ | Холодный старт при scale-to-zero. **Managed PostgreSQL в free tier нет**. YDB плохо дружит с Drizzle и Prisma [не проверено]. Больше настройки (реестр, IAM) |
| Timeweb, Selectel, Beget VPS | Docker Compose: Next.js + Postgres + Caddy на одной машине (гайд по Next.js с Postgres на Timeweb: [Хабр](https://habr.com/en/articles/858094), по сниппету) | VPS у Timeweb от ~400–882 ₽/мес (по сниппету) | Админить сервер, TLS и бэкапы самому. Это запасной путь, если PaaS упрётся |

[вывод] **Схема по умолчанию:** Amvera (приложение, тариф «Начальный» или выше) + Amvera managed PostgreSQL. Запасная: Timeweb Cloud Apps + Timeweb DBaaS. Код на GitHub (доступ жюри), зеркало в GitVerse по желанию.
[вывод] Держать вторую копию (Timeweb) не нужно, но после деплоя стоит проверить ссылку с мобильного интернета двух операторов и с домашнего Wi-Fi.

## 3. Аутентификация и авторизация

### Пароли и сессии
| Что | Как | Почему |
|---|---|---|
| Хеш пароля | argon2id через `@node-rs/argon2` (нативный, без node-gyp) [не проверено], либо bcrypt через `bcryptjs` | Требование брифа: «bcrypt, argon2 или аналог» |
| Сессия | Случайный токен в httpOnly + Secure + SameSite=Lax cookie, в БД лежит его хеш (схема Lucia `auth_session.ts`) или сессии Better Auth | Токен недоступен из JS браузера, сессию можно отозвать |
| Брутфорс | Rate limit на `/login` (встроен в Better Auth [не проверено]) | Жюри может попробовать перебор |
| Секреты | `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GIGACHAT_KEY` только в переменных окружения хостинга. В репозитории `.env.example` без значений. Без префикса `NEXT_PUBLIC_` | «Ключи не лежат в коде и в браузере» |

### Защита от IDOR (проверка владельца на сервере)
1. **Data Access Layer.** Все чтения и записи идут через `lib/dal/*.ts`, где первая строка — `const user = await requireUser()`, а запрос — `where(and(eq(requests.id, id), eq(requests.studentId, user.id)))`. Не нашли запись — отдаём `notFound()` (404, а не 403, чтобы не раскрывать, что запись существует).
2. **Server Actions = публичные POST-эндпоинты.** Проверяем сессию и владельца внутри каждого action, а не только в UI. `studentId` никогда не берём из формы.
3. **Middleware/proxy — не защита.** CVE-2025-29927 (03.2025) позволял обойти middleware Next.js заголовком `x-middleware-subrequest` ([nextjs.org/blog/cve-2025-29927](https://nextjs.org/blog/cve-2025-29927), 2025, [не проверено] — страница не открывалась). Middleware только для редиректа, проверка в DAL.
4. **ID в URL — UUID** вместо 1, 2, 3. Это затрудняет перебор, но не заменяет проверку из пункта 1.
5. **Опционально: Postgres RLS** (`SET app.user_id` + политики) как второй рубеж. Для одного человека за 11 дней это лишняя сложность [вывод].
6. **Роли:** при кабинете сотрудника нужна проверка `role === 'staff'` в DAL плюс отдельный тестовый аккаунт сотрудника (требование брифа).

### Как показать жюри (критерии 2 и 3)
- Playwright-тест `security.spec.ts`: войти как студент А, открыть `/requests/<id заявки Б>` и получить 404. Тот же сценарий через прямой POST к action или API. Скриншот прогона и видео в описании.
- В README раздел «Безопасность простыми словами»: таблица «угроза → защита → где в коде (файл:строка)».
- Скриншот строки из БД, где в `password_hash` лежит `$argon2id$...`.
- Это же даёт материал для критерия 2: спецификация безопасности в `docs/specs/` и правило в `CLAUDE.md` «любой запрос к БД только через DAL с userId».

## 4. UI: mobile-first, шрифты, иконки, PWA

| Кирпич | Зачем | Лицензия | Заметки |
|---|---|---|---|
| shadcn/ui + Radix + Tailwind v4 | Готовые Sheet, Drawer, Tabs, Card, Badge, Skeleton, Sonner (тосты) | MIT [не проверено] | Компоненты копируются в репозиторий, Claude правит их напрямую. Нижняя навигация и Drawer подходят под 360 px |
| Lucide icons | Иконки | ISC [не проверено] | Идёт с shadcn по умолчанию |
| Шрифты с кириллицей: **Golos Text**, Onest, Manrope, Inter | Типографика | SIL OFL [не проверено] | Подключать через `next/font/local` или `@fontsource/*` из npm, чтобы не зависеть от Google Fonts во время сборки в РФ [вывод] |
| Иллюстрации пустых состояний | Критерий 4: «продуманы пустые состояния» | Генерация (см. §6) или свои SVG | Стоки с атрибуцией (Storyset/Freepik) лучше не брать |
| PWA: `manifest.webmanifest` + service worker (Serwist для Next.js [не проверено]) | Иконка на домашнем экране, офлайн-заглушка | — | Дёшево и заметно на видео с телефона |
| Web Push (`web-push` + VAPID-ключи на сервере) | Напоминания о дедлайнах | — | На iPhone только для PWA с домашнего экрана, iOS 16.4+. Declarative Web Push с iOS 18.4 ([webkit.org](https://webkit.org/?p=16535), по сниппету, 2025). На Android Chrome push идёт через FCM (Google), его доступность из РФ [не проверено]. **Ядро уведомлений делаем лентой внутри кабинета, push только бонусом** [вывод] |

## 5. ИИ-функции в кабинете (если будет ассистент)

| API | Доступ из РФ | Бесплатно и цена | Подводные камни |
|---|---|---|---|
| **GigaChat API (Сбер)** | Да, физлицо через developers.sber.ru | Freemium **365 млн токенов на 12 месяцев**: Lite 250 млн, Pro 40 млн, Max 25 млн, GigaChat-3-Ultra 50 млн. Один поток. Пакет 2 Lite 20 млн за 1 300 ₽ ([тарифы](https://developers.sber.ru/docs/ru/gigachat/tariffs/individual-tariffs), обновлено 07.10.2026) | Один поток: при параллельных запросах жюри будет очередь. Нужен сертификат НУЦ Минцифры (Russian Trusted Root CA) или флаг отключения проверки в SDK [не проверено]. С 09.2026 новые клиенты платят через cloud.ru (по сниппету) |
| **Yandex AI Studio** (YandexGPT 5 Lite, Pro 5.1, Alice AI LLM) | Да, нужен платёжный аккаунт Yandex Cloud | YandexGPT 5 Lite около $1,64 за 1 млн токенов, Alice AI LLM Flash около $0,82/$1,64 (агрегатор, 13.10.2026, по сниппету). Российские LLM ~0,5–1,2 ₽ за 1 тыс. токенов ([TKS](https://www.tks.ru/technology/2026/08/25/0004/), 2026, по сниппету) | Платформа переименована из Foundation Models в AI Studio (01.2026). Есть OpenAI-совместимый эндпоинт [не проверено] |
| Claude/OpenAI | Amvera проксирует трафик к ним через зарубежный IP ([amvera.ru](https://amvera.ru/)) | Оплата из РФ проблемна [вывод] | Не основной вариант |

Правило: вызов LLM только из Route Handler или Server Action после `requireUser()`. В промпт передаём только данные текущего студента из DAL (иначе получаем IDOR через ИИ). На запросы к LLM ставим rate limit на пользователя. Сценарии: «объясни мою успеваемость», «помоги выбрать справку», «что изменилось в расписании» [вывод].

## 6. ИИ для дизайна и контента, инструменты проверки

| Инструмент | Зачем | Доступ из РФ и риск |
|---|---|---|
| Claude Code + навыки (ui-ux-pro-max, frontend-design) + shadcn MCP | Генерация UI прямо в репозитории, всё это идёт в критерий 2 | Уже у команды |
| v0 (Vercel) | Быстрые варианты экранов на shadcn | Сайт Vercel, доступ из РФ нестабилен (см. §2), оплата недоступна [вывод]. Опционально, через VPN на этапе дизайна (это не прод) |
| Kandinsky (Сбер), Шедеврум (Яндекс) | Иллюстрации для пустых состояний и онбординга, логотип концепта | Российские. Условия использования изображений сверить [не проверено] |
| Playwright | E2E-сценарии ядра (вход → расписание → оценки → заявка → статус), viewport 360×800, тест IDOR, скриншоты для описания | Работает локально |
| Lighthouse (Chrome DevTools/CLI) | Performance, Accessibility, PWA: цифры для критерия 4 | Локально через CLI, без внешних сервисов |
| axe-core (`@axe-core/playwright`) | Автопроверка доступности | Локально |

## 7. Сводная таблица

| Технология | Зачем нам | Время на подключение | Риск | Доки |
|---|---|---|---|---|
| Next.js 16 + TS | Фреймворк, SSR, Server Actions | 0,5 ч | Дыры в Server Actions (§3) | nextjs.org/docs |
| Drizzle ORM + PostgreSQL | Данные, миграции, сид двух студентов | 1–2 ч | Managed PG на хостинге платный (от 170 ₽) | orm.drizzle.team |
| Better Auth (+ argon2) | Вход, сессии | 2–3 ч | Новая библиотека, ИИ может путать API с Auth.js | better-auth.com |
| shadcn/ui + Tailwind | Мобильный UI | 1 ч | Шаблонный вид, нужна своя тема | ui.shadcn.com |
| Amvera | Хостинг + БД в РФ | 1–2 ч (первый деплой) | Мало RAM на дешёвых тарифах, тарифы сверить | docs.amvera.ru |
| Timeweb Cloud Apps | Запасной хостинг | 1–2 ч | Цены бэкенда не опубликованы на лендинге | timeweb.cloud/docs |
| GigaChat API | ИИ-ассистент | 1–2 ч (ключ сразу, сертификат) | Один поток, TLS-сертификат НУЦ | developers.sber.ru/docs/ru/gigachat |
| Playwright + Lighthouse | Проверка, доказательства для жюри | 1–2 ч | Нет | playwright.dev |
| PWA + web-push | Бонус к «каждый день» | 2–4 ч | iOS только с домашнего экрана, FCM из РФ [не проверено] | web.dev / webkit.org |

## 8. Риски

| Риск | Вероятность | Что делать |
|---|---|---|
| Сайт не открывается у жюри (блокировки, «белые списки» мобильного интернета 2026) | Средняя | Российский хостинг. Проверка с 2–3 сетей. Видео-демо как страховка. В 2026 в РФ ужесточили контроль, расширяют «белые списки» ([Вокруг света](https://www.vokrugsveta.ru/history/blokirovki-belye-spiski-i-suverennyi-runet-chto-proiskhodit-s-internetom-v-rossii-v-2026-godu-id6937385/), 2026, по сниппету) |
| Хостинг выключит приложение, когда кончится баланс, до 28.11 | Средняя | Пополнить баланс с запасом до 30.11, поставить напоминание [вывод] |
| Холодный старт (Yandex Serverless) | Высокая на SC | На Amvera и Timeweb контейнер работает постоянно [не проверено]. На SC нужен prepared instance (платно) |
| Next.js не влезает в RAM дешёвого тарифа | Средняя | `output: 'standalone'`, тариф от 290–490 ₽, сборка в Docker |
| Сборка в РФ не скачивает зависимости (npm, Google Fonts) | Низкая–средняя | Шрифты локально, lock-файл, при проблеме собираем Docker-образ локально [вывод] |
| GigaChat: один поток, TLS | Средняя | Очередь и таймаут, понятное состояние «ассистент занят», кэш частых ответов |
| ИИ генерирует дыры (IDOR в action, ключ в `NEXT_PUBLIC_`) | Высокая | Правило в CLAUDE.md, Playwright-тест IDOR в CI, grep на `NEXT_PUBLIC_.*KEY` [вывод] |

## Вне скоупа
- Amvera бесплатно проксирует трафик к API Telegram: если нужен Telegram-бот деканата для уведомлений, это пригодится.
- Django admin как готовый «кабинет сотрудника» может быть сильным ходом для идеи (решают генераторы идей).

## Источники
- Vercel Community: Regional access to vercel.app varies by ingress IP from Russia — https://community.vercel.com/t/regional-access-to-vercel-app-varies-by-ingress-ip-from-russia/49777 (2026)
- Vercel Community: Production domain blocked in Russia — https://community.vercel.com/t/urgent-production-domain-bbqp-pro-is-blocked-in-russia-confirmed-vercel-ip-issue/29141 (2026, по сниппету)
- The Record: Cloudflare confirms Russia restricting access — https://therecord.media/cloudflare-russia-restricting-access-crackdown (2025)
- digitalbusiness.kz: блокировка защищённых DNS Google и Cloudflare — https://digitalbusiness.kz/2026-08-25/v-rossii-nachali-blokirovat-zashchishchennie-servisi-google-i-cloudflare/ (2026, по сниппету)
- kod.ru: российские разработчики испытывают проблемы — https://kod.ru/rossiskie-rezrabotchiki-ispitivaut-problemi (2026)
- Вокруг света: блокировки, белые списки, 2026 — https://www.vokrugsveta.ru/history/blokirovki-belye-spiski-i-suverennyi-runet-chto-proiskhodit-s-internetom-v-rossii-v-2026-godu-id6937385/ (2026, по сниппету)
- Supabase: Navigating Regional Network Blocks — https://supabase.com/blog/navigating-regional-network-blocks (2026, по сниппету)
- Amvera, главная — https://amvera.ru/ (2026)
- Amvera на Хабре: Next.js/Node.js — https://habr.com/ru/companies/amvera/articles/819085 (2024, по сниппету)
- toolfox: тарифы Amvera — https://toolfox.ru/services/s/amvera (2026, по сниппету)
- Timeweb Cloud Apps — https://timeweb.cloud/services/apps (2026)
- subger: Timeweb — https://subger.com/en/service/timeweb-ru (по сниппету)
- Yandex Cloud: Serverless free tier — https://yandex.cloud/ru/docs/billing/concepts/serverless-free-tier (обновлено 09.11.2026)
- Sber: тарифы GigaChat для физлиц — https://developers.sber.ru/docs/ru/gigachat/tariffs/individual-tariffs (обновлено 07.10.2026)
- Yandex AI Studio pricing — https://yandex.cloud/en/docs/ai-studio/pricing (2026, по сниппету)
- llmreference: YandexGPT 5 Lite, Alice AI LLM Flash — https://www.llmreference.com/provider/yandex-cloud-yandexgpt-api/yandexgpt-5-lite (10.2026, по сниппету)
- TKS: российские LLM подешевели до 67% — https://www.tks.ru/technology/2026/08/25/0004/ (2026, по сниппету)
- Better Auth joins Vercel — https://better-auth.com/blog/better-auth-joins-vercel (2026, по сниппету)
- Auth.js is now part of Better Auth — https://better-auth.com/blog/authjs-joins-better-auth (2025, по сниппету)
- Lucia — https://lucia-auth.com/ (2026)
- Next.js support policy — https://nextjs.org/support-policy (2025–2026, по сниппету)
- versionlog: Next.js 16 — https://versionlog.com/nextjs/16/ (2026, по сниппету)
- Next.js CVE-2025-29927 — https://nextjs.org/blog/cve-2025-29927 (2025, не открывалась)
- WebKit: Meet Declarative Web Push — https://webkit.org/?p=16535 (2025, по сниппету)
- Хабр: Next.js + PostgreSQL на Timeweb Cloud — https://habr.com/en/articles/858094 (по сниппету)
