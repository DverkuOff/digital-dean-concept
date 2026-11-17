import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// PWA: манифест, офлайн-доступ к трём страницам, раздельный кэш и его очистка при выходе.

test("манифест и иконки отдаются без входа", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  const m = await res.json();
  expect(m.start_url).toBe("/today");
  expect(m.display).toBe("standalone");
  expect((await request.get("/icons/icon-192.png")).status()).toBe(200);
  expect((await request.get("/sw.js")).status()).toBe(200);
});

test("без сети открываются «Сегодня», «Расписание», «Учёба» с пометкой; после выхода кэш стёрт", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await ctx.newPage();
  await login(page, "orlov");
  await expect(page).toHaveURL(/\/today$/);
  // Сервис-воркер сохранил страницы и их скрипты.
  await expect(page.locator("html[data-offline-ready='1']")).toHaveCount(1, { timeout: 20_000 });

  await ctx.setOffline(true);
  await page.goto("/grades");
  await expect(page.getByTestId("how-am-i")).toContainText("Есть долг");
  await expect(page.getByTestId("offline-banner")).toContainText("Нет сети");
  await page.goto("/schedule");
  await expect(page.getByRole("heading", { name: "Расписание" })).toBeVisible();
  await page.goto("/requests"); // не кэшируется
  await expect(page.getByRole("heading", { name: "Нет сети" })).toBeVisible();

  await ctx.setOffline(false);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/login$/);
  const left = await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith("orientir-pages-") || k === "orientir-meta"));
  expect(left).toEqual([]);

  // Без сети после выхода персональных данных на устройстве нет.
  await ctx.setOffline(true);
  await page.goto("/grades");
  await expect(page.getByRole("heading", { name: "Нет сети" })).toBeVisible();
  await expect(page.getByText("Макроэкономика")).toHaveCount(0);
  await ctx.close();
});
