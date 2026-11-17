import { test, expect } from "@playwright/test";
import { AUTH, requestIdOf, sql } from "./helpers";

// Безопасность из брифа: IDOR → 404, роль методиста проверяется на сервере, а не в интерфейсе.

test.describe("без входа", () => {
  test("закрытые страницы уводят на вход", async ({ page }) => {
    for (const path of ["/today", "/requests", "/staff", "/rating"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test("неверный пароль не пускает", async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Войти по логину и паролю").click();
    await page.getByLabel("Логин").fill("sokolova");
    await page.getByLabel("Пароль").fill("wrong-password");
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.locator("main [role=alert]")).toContainText("Неверный логин или пароль");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("студентка А (Соколова)", () => {
  test.use({ storageState: AUTH.a });

  test("чужая заявка по прямому адресу → 404", async ({ page }) => {
    const foreignId = await requestIdOf("Орлов", "absence_excuse");
    const res = await page.goto(`/requests/${foreignId}`);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Страница не найдена" })).toBeVisible();
    await expect(page.getByText("Орлов")).toHaveCount(0);
  });

  test("своя заявка открывается", async ({ page }) => {
    const ownId = await requestIdOf("Соколова", "study_certificate");
    const res = await page.goto(`/requests/${ownId}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Справка об обучении" })).toBeVisible();
  });

  test("очередь методиста для студента → 404", async ({ page }) => {
    const res = await page.goto("/staff");
    expect(res?.status()).toBe(404);
    await expect(page.getByTestId("queue")).toHaveCount(0);
  });

  test("мусор вместо id → 404, а не ошибка сервера", async ({ page }) => {
    const res = await page.goto("/requests/1%27%20or%201=1--");
    expect(res?.status()).toBe(404);
  });

  test("рейтинг показывает место агрегатом, без чужих имён", async ({ page }) => {
    await page.goto("/rating");
    await expect(page.getByTestId("cohort-place")).toBeVisible();
    const html = await page.content();
    for (const name of ["Орлов", "Абрамова", "Белов", "Воронцова", "Гусев"]) expect(html).not.toContain(name);
  });
});

test.describe("студент Б (Орлов)", () => {
  test.use({ storageState: AUTH.b });

  test("подмена id в форме повторной подачи не меняет чужую заявку", async ({ page }) => {
    const ownReturned = await requestIdOf("Орлов", "absence_excuse");
    const foreignId = await requestIdOf("Соколова", "study_certificate");
    const before = await sql<{ status: string; payload: unknown }>(`select status, payload from request where id = $1`, [foreignId]);

    await page.goto(`/requests/${ownReturned}`);
    // Подменяем скрытое поле requestId на id чужой заявки, как сделал бы злоумышленник.
    await page.locator('section[aria-labelledby="ret"] input[name="requestId"]').evaluate((el, id) => ((el as HTMLInputElement).value = id), foreignId);
    await page.getByRole("button", { name: "Исправить и подать снова" }).click();
    await expect(page.locator("main [role=alert]")).toContainText("Заявка не найдена");

    const after = await sql<{ status: string; payload: unknown }>(`select status, payload from request where id = $1`, [foreignId]);
    expect(after).toEqual(before);
  });
});

test("действие методиста, отправленное студентом, отклоняется на сервере", async ({ browser }) => {
  const targetId = await requestIdOf("Орлов", "military_certificate"); // статус in_progress
  // 1. Методист открывает очередь: берём настоящую форму смены статуса (с id серверного действия).
  const staff = await browser.newContext({ storageState: AUTH.staff });
  const sp = await staff.newPage();
  await sp.goto("/staff");
  const item = sp.locator(`[data-request-id="${targetId}"]`);
  await item.locator("summary").click();
  const form = item.locator("form").first();
  const entries = await form.evaluate((f) => {
    const out: [string, string][] = [];
    new FormData(f as HTMLFormElement).forEach((v, k) => out.push([k, String(v)]));
    return out;
  });
  await staff.close();

  // 2. Студент отправляет ту же форму со своей сессией и пытается перевести заявку в «Готова».
  const student = await browser.newContext({ storageState: AUTH.b });
  const multipart: Record<string, string> = Object.fromEntries(entries);
  multipart.to = "ready";
  const res = await student.request.post("/staff", { multipart, maxRedirects: 0 });
  expect(res.status()).toBeLessThan(500);
  await student.close();

  const [row] = await sql<{ status: string }>(`select status from request where id = $1`, [targetId]);
  expect(row.status).toBe("in_progress");

  // 3. Контрольный опыт: та же отправка от методиста срабатывает — значит, отказ выше дал сервер, а не сломанный запрос.
  const staff2 = await browser.newContext({ storageState: AUTH.staff });
  await staff2.request.post("/staff", { multipart, maxRedirects: 0 });
  await staff2.close();
  const [row2] = await sql<{ status: string }>(`select status from request where id = $1`, [targetId]);
  expect(row2.status).toBe("ready");
});

// Находка аудита К1: Better Auth открывал change-password, update-user и др. —
// любой мог сменить пароль или логин общего демо-аккаунта и сломать вход всему жюри.
test("служебные эндпоинты Better Auth закрыты, вход после попыток по-прежнему работает", async ({ playwright, baseURL }) => {
  const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL!, "X-Forwarded-For": process.env.E2E_CLIENT_IP ?? "10.9.9.9" } });
  const signIn = await api.post("/api/auth/sign-in/username", { data: { username: "orlov", password: "demo2026" } });
  expect(signIn.status()).toBe(200);

  const attacks: [string, string, unknown?][] = [
    ["POST", "/api/auth/update-user", { username: "orlov_x", name: "Взломщик" }],
    ["POST", "/api/auth/change-password", { currentPassword: "demo2026", newPassword: "hacked12345", revokeOtherSessions: true }],
    ["POST", "/api/auth/revoke-sessions", {}],
    ["POST", "/api/auth/revoke-other-sessions", {}],
    ["GET", "/api/auth/list-sessions"],
    ["POST", "/api/auth/sign-in/email", { email: "orlov@demo.invalid", password: "demo2026" }],
    ["POST", "/api/auth/is-username-available", { username: "orlov" }],
    ["POST", "/api/auth/sign-up/email", { email: "x@demo.invalid", password: "demo20266", name: "x" }],
    ["POST", "/api/auth/delete-user", {}],
  ];
  for (const [method, path, data] of attacks) {
    const res = method === "GET" ? await api.get(path) : await api.post(path, { data });
    expect(res.status(), `${method} ${path}`).toBe(404);
  }

  const [u] = await sql<{ username: string; name: string }>(`select username, name from "user" where email = 'orlov@demo.invalid'`);
  expect(u).toEqual({ username: "orlov", name: "Максим Орлов" });
  const again = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL!, "X-Forwarded-For": process.env.E2E_CLIENT_IP ?? "10.9.9.9" } });
  expect((await again.post("/api/auth/sign-in/username", { data: { username: "orlov", password: "demo2026" } })).status()).toBe(200);
  expect((await again.get("/api/auth/get-session")).status()).toBe(200);
  await again.dispose();
  await api.dispose();
});

// Находка аудита В1: без определения IP все попадали в один общий счётчик, и чужие ошибки
// блокировали вход остальным. Теперь лимит — на IP: перебор с одного адреса не мешает другому.
test("лимит входа считается по IP: перебор с одного адреса не блокирует другой", async ({ playwright, baseURL }) => {
  const attackerIp = `10.66.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const attacker = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL!, "X-Forwarded-For": attackerIp } });
  const codes: number[] = [];
  for (let i = 0; i < 32; i++) {
    codes.push((await attacker.post("/api/auth/sign-in/username", { data: { username: "sokolova", password: `wrong-${i}` } })).status());
  }
  expect(codes).toContain(429); // перебор упёрся в лимит
  await attacker.dispose();

  const other = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL!, "X-Forwarded-For": `10.77.${Math.floor(Math.random() * 250)}.1` } });
  expect((await other.post("/api/auth/sign-in/username", { data: { username: "sokolova", password: "demo2026" } })).status()).toBe(200);
  await other.dispose();
});

// Находка аудита В4: в браузер уходил массив точных рейтингов всех 61 однокурсника.
// Лучшего на курсе все знают — значит, его рейтинг раскрыт. Теперь наружу — только место и грубая гистограмма.
test("на странице рейтинга нет точных рейтингов однокурсников", async ({ browser }) => {
  const top = await sql<{ r: string }>(`
    select round((sum(g.final_score * d.credits) / sum(d.credits))::numeric, 1)::text as r
    from grade g join discipline d on d.id = g.discipline_id join student s on s.id = g.student_id
    where s.user_id is null and d.control_type in ('exam', 'diff_credit') and g.status in ('passed', 'debt')
    group by s.id order by 1 desc limit 5`);
  expect(top.length).toBe(5);
  const ctx = await browser.newContext({ storageState: AUTH.b });
  const page = await ctx.newPage();
  const res = await page.goto("/rating");
  const html = await res!.text(); // HTML вместе с данными для React (RSC)
  await expect(page.getByTestId("cohort-place")).toBeVisible();
  for (const { r } of top) expect(html, `рейтинг ${r}`).not.toContain(r);
  expect(html).not.toMatch(/"cohort":\[/);
  await ctx.close();
});
