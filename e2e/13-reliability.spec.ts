import { test, expect, type Browser } from "@playwright/test";
import { login, sql } from "./helpers";

// Регрессия по находкам аудита: М1 (заголовки), М2 (гонка номера), М5 (гонка статуса), М6 (лимит заявок), М7 (health).

test("health и заголовки безопасности", async ({ request }) => {
  const h = await request.get("/api/health");
  expect(h.status()).toBe(200);
  expect(await h.json()).toEqual({ ok: true, db: "up" });
  const res = await request.get("/login");
  const hd = res.headers();
  expect(hd["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(hd["content-security-policy"]).toContain("default-src 'self'");
  expect(hd["strict-transport-security"]).toContain("max-age=");
  expect(hd["permissions-policy"]).toContain("camera=()");
  expect(hd["x-frame-options"]).toBe("DENY");
});

async function studentPage(browser: Browser, username: string) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await ctx.newPage();
  await login(page, username);
  await expect(page).toHaveURL(/\/today$/);
  return { ctx, page };
}

test("8 одновременных подач: все созданы, номера уникальны; 11-я активная заявка отклоняется", async ({ browser }) => {
  const { ctx } = await studentPage(browser, "sokolova3");
  const pages = await Promise.all(Array.from({ length: 8 }, () => ctx.newPage()));
  await Promise.all(
    pages.map(async (p, i) => {
      await p.goto("/requests/new?type=transcript");
      await p.getByLabel(/Язык/).selectOption("Русский");
      await p.getByLabel(/Для чего/).fill(`Гонка ${i}`);
    }),
  );
  await Promise.all(pages.map((p) => p.getByRole("button", { name: "Подать заявку" }).click()));
  for (const p of pages) await expect(p.getByTestId("status-badge")).toHaveText("Подана");

  const rows = await sql<{ number: string }>(
    `select r.number from request r join student s on s.id = r.student_id join "user" u on u.id = s.user_id
     where u.username = 'sokolova3' and r.payload->>'purpose' like 'Гонка %'`,
  );
  expect(rows).toHaveLength(8);
  expect(new Set(rows.map((r) => r.number)).size).toBe(8);

  // У sokolova3 уже 9 активных (готовая справка + 8): десятая проходит, одиннадцатая — нет.
  const p = pages[0];
  for (const [i, ok] of [[9, true], [10, false]] as const) {
    await p.goto("/requests/new?type=transcript");
    await p.getByLabel(/Язык/).selectOption("Русский");
    await p.getByLabel(/Для чего/).fill(`Лимит ${i}`);
    await p.getByRole("button", { name: "Подать заявку" }).click();
    if (ok) await expect(p.getByTestId("status-badge")).toHaveText("Подана");
    else await expect(p.locator("main [role=alert]")).toContainText("10 активных заявок");
  }
  await ctx.close();
});

test("два методиста одновременно жмут «Взять в работу»: один переход и одно уведомление", async ({ browser }) => {
  const [target] = await sql<{ id: string }>(`select r.id from request r where r.status = 'submitted' order by r.created_at desc limit 1`);
  expect(target).toBeTruthy();
  // Берём настоящую форму из очереди и отправляем её двумя методистами параллельно (как два клика в одну секунду).
  const contexts = await Promise.all(
    ["metodist2", "metodist3"].map(async (u) => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      await login(page, u);
      await expect(page).toHaveURL(/\/staff$/);
      return { ctx, page };
    }),
  );
  const { page } = contexts[0];
  await page.goto("/staff?f=submitted");
  const item = page.locator(`[data-request-id="${target.id}"]`);
  await item.locator("summary").click();
  const entries = await item.locator("form").first().evaluate((f) => {
    const out: [string, string][] = [];
    new FormData(f as HTMLFormElement).forEach((v, k) => out.push([k, String(v)]));
    return out;
  });
  const multipart: Record<string, string> = { ...Object.fromEntries(entries), to: "in_progress" };
  await Promise.all(contexts.map(({ ctx }) => ctx.request.post("/staff", { multipart, maxRedirects: 0 })));

  const events = await sql<{ n: number }>(`select count(*)::int as n from request_event where request_id = $1 and status = 'in_progress'`, [target.id]);
  const notes = await sql<{ n: number }>(`select count(*)::int as n from notification where link = $1`, [`/requests/${target.id}`]);
  expect(events[0].n).toBe(1);
  expect(notes[0].n).toBe(1);
  for (const { ctx } of contexts) await ctx.close();
});

// Находки ревьюера доступа: лимит активных заявок при параллельных подачах и двойная повторная подача.
test("параллельные подачи не обходят лимит в 10 активных заявок", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const first = await ctx.newPage();
  await login(first, "orlov2");
  await expect(first).toHaveURL(/\/today$/);
  const [{ n: before }] = await sql<{ n: number }>(
    `select count(*)::int as n from request r join student s on s.id = r.student_id join "user" u on u.id = s.user_id
     where u.username = 'orlov2' and r.status in ('submitted','in_progress','returned','ready')`,
  );
  const tries = 10 - before + 4; // на 4 больше, чем позволяет лимит
  const pages = await Promise.all(Array.from({ length: tries }, () => ctx.newPage()));
  await Promise.all(
    pages.map(async (p, i) => {
      await p.goto("/requests/new?type=transcript");
      await p.getByLabel(/Язык/).selectOption("Русский");
      await p.getByLabel(/Для чего/).fill(`Параллельно ${i}`);
    }),
  );
  await Promise.all(pages.map((p) => p.getByRole("button", { name: "Подать заявку" }).click()));
  await Promise.all(pages.map((p) => expect(p.getByTestId("status-badge").or(p.locator("main [role=alert]"))).toBeVisible()));
  const [{ n: after }] = await sql<{ n: number }>(
    `select count(*)::int as n from request r join student s on s.id = r.student_id join "user" u on u.id = s.user_id
     where u.username = 'orlov2' and r.status in ('submitted','in_progress','returned','ready')`,
  );
  expect(after).toBe(10);
  await ctx.close();
});

test("двойная повторная подача возвращённой заявки даёт одно событие", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await ctx.newPage();
  await login(page, "sokolova2");
  await expect(page).toHaveURL(/\/today$/);
  // Готовим возврат: заявка sokolova2 переводится методистом… быстрее — сразу в БД, это не предмет теста.
  const [r] = await sql<{ id: string }>(
    `update request set status = 'returned', return_reason = 'Тест', updated_at = now()
     where id = (select r.id from request r join student s on s.id = r.student_id join "user" u on u.id = s.user_id
                 where u.username = 'sokolova2' and r.type = 'transcript' order by r.created_at limit 1)
     returning id`,
  );
  await page.goto(`/requests/${r.id}`);
  const entries = await page.locator('section[aria-labelledby="ret"] form').evaluate((f) => {
    const out: [string, string][] = [];
    new FormData(f as HTMLFormElement).forEach((v, k) => out.push([k, String(v)]));
    return out;
  });
  const multipart = Object.fromEntries(entries) as Record<string, string>;
  await Promise.all([1, 2].map(() => ctx.request.post(`/requests/${r.id}`, { multipart, maxRedirects: 0 })));
  const [{ n }] = await sql<{ n: number }>(
    `select count(*)::int as n from request_event where request_id = $1 and comment = 'Исправлена и подана повторно'`,
    [r.id],
  );
  expect(n).toBe(1);
  await ctx.close();
});

test("4 одновременных «Подать заявление» из рейтинга создают одно заявление (находка ПМИ 20.11)", async ({ browser }) => {
  const { ctx } = await studentPage(browser, "orlov3");
  const count = () =>
    sql<{ n: number }>(
      `select count(*)::int as n from request r join student s on s.id = r.student_id join "user" u on u.id = s.user_id
       where u.username = 'orlov3' and r.type = 'retake_application' and r.status in ('submitted','in_progress','returned','ready')`,
    ).then((r) => r[0].n);
  const before = await count();
  const pages = await Promise.all(Array.from({ length: 4 }, () => ctx.newPage()));
  await Promise.all(pages.map((p) => p.goto("/rating")));
  await Promise.all(pages.map((p) => p.getByRole("button", { name: "Подать заявление" }).click()));
  await Promise.all(pages.map((p) => expect(p).toHaveURL(/\/requests\/[0-9a-f-]{36}/)));
  expect((await count()) - before).toBeLessThanOrEqual(1);
  // Все четыре вкладки пришли к одной и той же заявке.
  const ids = new Set(pages.map((p) => new URL(p.url()).pathname));
  expect(ids.size).toBe(1);
  await ctx.close();
});
