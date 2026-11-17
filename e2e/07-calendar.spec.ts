import { test, expect, type Page } from "@playwright/test";
import { AUTH } from "./helpers";

// Подписка на расписание (.ics): доступ только по секретному токену, перевыпуск отзывает старый.

async function issue(page: Page) {
  await page.goto("/schedule/calendar");
  const fresh = page.getByRole("button", { name: "Получить ссылку" });
  if (await fresh.isVisible()) await fresh.click();
  else {
    await page.getByRole("button", { name: "Перевыпустить ссылку" }).click();
    await page.getByRole("button", { name: "Да, перевыпустить" }).click();
  }
  const url = (await page.getByTestId("calendar-url").textContent())!.trim();
  expect(url).toMatch(/\/api\/calendar\/[A-Za-z0-9_-]{43}\.ics$/);
  return new URL(url).pathname;
}

test.describe("Орлов", () => {
  test.use({ storageState: AUTH.b, viewport: { width: 360, height: 800 } });

  test("ссылка отдаёт его расписание с переносами; перевыпуск отзывает старую; чужой токен → 404", async ({ page, playwright }) => {
    await page.goto("/schedule");
    await page.getByTestId("calendar-teaser").click();
    await expect(page).toHaveURL(/\/schedule\/calendar$/);
    const first = await issue(page);

    // Календарное приложение приходит без cookie.
    const anon = await playwright.request.newContext({ baseURL: new URL(page.url()).origin });
    const res = await anon.get(first);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    const ics = (await res.text()).replace(/\r\n /g, "");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("МЭО-204");
    expect(ics).toContain("SUMMARY:Перенос: Эконометрика");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("данные вымышлены");

    const second = await issue(page);
    expect(second).not.toBe(first);
    expect((await anon.get(first)).status()).toBe(404);
    expect((await anon.get(second)).status()).toBe(200);

    // Случайный токен правильного формата и мусор → 404.
    expect((await anon.get("/api/calendar/" + "A".repeat(43) + ".ics")).status()).toBe(404);
    expect((await anon.get("/api/calendar/abc.ics")).status()).toBe(404);
    expect((await anon.get("/api/calendar/%27%20or%201%3D1--")).status()).toBe(404);
    await anon.dispose();
  });
});

test.describe("Соколова", () => {
  test.use({ storageState: AUTH.a });

  test("в её календаре только её группа", async ({ page, playwright }) => {
    const path = await issue(page);
    const anon = await playwright.request.newContext({ baseURL: new URL(page.url()).origin });
    const ics = await (await anon.get(path)).text();
    expect(ics).toContain("МЭО-201");
    expect(ics).not.toContain("МЭО-204");
    await anon.dispose();
  });
});
