import { test, expect, type Browser } from "@playwright/test";
import { login, sql } from "./helpers";

// «Вопрос в учебный офис»: переписка внутри заявки с проверкой владельца и роли.
async function as(browser: Browser, username: string, width = 360) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await login(page, username);
  await expect(page).not.toHaveURL(/\/login$/);
  return { ctx, page };
}

const militaryOf = async (username: string) =>
  (
    await sql<{ id: string }>(
      `select r.id from request r join student s on s.id = r.student_id join "user" u on u.id = s.user_id
       where u.username = $1 and r.type = 'military_certificate'`,
      [username],
    )
  )[0].id;

test("студент спрашивает, методист отвечает, студент видит ответ и уведомление", async ({ browser }) => {
  const id = await militaryOf("orlov2");
  const s = await as(browser, "orlov2");
  await s.page.goto(`/requests/${id}`);
  await s.page.getByLabel("Вопрос учебному офису").fill("Нужен ли приписной, чтобы забрать справку?");
  await s.page.getByRole("button", { name: "Отправить вопрос" }).click();
  await expect(s.page.getByTestId("message").filter({ hasText: "приписной" })).toBeVisible();

  const m = await as(browser, "metodist2", 1280);
  await m.page.goto("/staff");
  const item = m.page.locator(`[data-request-id="${id}"]`);
  await expect(item.getByTestId("awaiting-reply")).toBeVisible();
  await item.locator("summary").click();
  await item.getByLabel("Ответ студенту").fill("Да, возьмите приписное и паспорт.");
  await item.getByRole("button", { name: "Ответить" }).click();
  await expect(item.getByTestId("message").filter({ hasText: "приписное и паспорт" })).toBeVisible();
  await m.page.reload();
  await expect(m.page.locator(`[data-request-id="${id}"]`).getByTestId("awaiting-reply")).toHaveCount(0);
  await m.ctx.close();

  await s.page.reload();
  await expect(s.page.locator('[data-testid="message"][data-author="staff"]')).toContainText("приписное и паспорт");
  await s.page.goto("/notifications");
  await expect(s.page.getByTestId("notifications")).toContainText("Ответ учебного офиса: справка для военкомата");
  await s.ctx.close();
});

test("подменённый requestId: вопрос в чужую заявку не попадает", async ({ browser }) => {
  const foreign = await militaryOf("orlov3");
  const own = (await sql<{ id: string }>(
    `select r.id from request r join student s on s.id = r.student_id join "user" u on u.id = s.user_id where u.username = 'sokolova2' limit 1`,
  ))[0].id;
  const s = await as(browser, "sokolova2");
  await s.page.goto(`/requests/${own}`);
  await s.page.locator('[data-testid="thread"] input[name="requestId"]').evaluate((el, v) => ((el as HTMLInputElement).value = v), foreign);
  await s.page.getByLabel("Вопрос учебному офису").fill("взлом");
  await s.page.getByRole("button", { name: "Отправить вопрос" }).click();
  await expect(s.page.locator('[data-testid="thread"] [role=alert]')).toContainText("Заявка не найдена");
  const n = await sql<{ n: number }>(`select count(*)::int as n from request_message where request_id = $1`, [foreign]);
  expect(n[0].n).toBe(0);
  await s.ctx.close();
});

test("ответ методиста, отправленный студентом, отклоняется сервером", async ({ browser }) => {
  // Готовим переписку: студент orlov3 задаёт вопрос, у методиста появляется форма ответа.
  const id = await militaryOf("orlov3");
  const s = await as(browser, "orlov3");
  await s.page.goto(`/requests/${id}`);
  await s.page.getByLabel("Вопрос учебному офису").fill("Когда можно забрать?");
  await s.page.getByRole("button", { name: "Отправить вопрос" }).click();
  await expect(s.page.getByTestId("message")).toHaveCount(1);

  const m = await as(browser, "metodist3", 1280);
  await m.page.goto("/staff");
  const item = m.page.locator(`[data-request-id="${id}"]`);
  await item.locator("summary").click();
  const form = item.getByTestId("thread").locator("form");
  const entries = await form.evaluate((f) => {
    const out: [string, string][] = [];
    new FormData(f as HTMLFormElement).forEach((v, k) => out.push([k, String(v)]));
    return out;
  });
  await m.ctx.close();
  const multipart: Record<string, string> = { ...Object.fromEntries(entries), text: "Подделка от студента" };
  await s.ctx.request.post("/staff", { multipart, maxRedirects: 0 });
  const rows = await sql<{ n: number }>(`select count(*)::int as n from request_message where request_id = $1 and author = 'staff'`, [id]);
  expect(rows[0].n).toBe(0);
  await s.ctx.close();
});
