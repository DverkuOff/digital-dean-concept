import { test, expect, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import { login } from "../helpers";

// Кадры для README (media/screens): телефон 390×844 и компьютер 1280×640, ×2, на свежем демо.
// PW_CHANNEL=chrome npx playwright test -c playwright.screens.config.ts readme-media
// PNG пишутся в test-results/readme-media, в WebP для media/screens их переводит cwebp (см. README, «Медиа»).
const DIR = "test-results/readme-media";
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 640 };
fs.mkdirSync(DIR, { recursive: true });

async function as(browser: Browser, username: string, viewport = PHONE, colorScheme: "light" | "dark" = "light") {
  const mobile = viewport.width < 600;
  const ctx = await browser.newContext({ viewport, colorScheme, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await login(page, username);
  await expect(page).not.toHaveURL(/\/login$/);
  return { ctx, page };
}

// Снимок окна; перед ним — прокрутка к элементу (он окажется на высоте `at` от верха) и пауза на анимации появления.
async function shot(page: Page, name: string, scrollTo?: ReturnType<Page["locator"]>, at = 130) {
  if (scrollTo) {
    await scrollTo.first().waitFor();
    await scrollTo.first().evaluate((el, at) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - at), at);
  } else {
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${DIR}/${name}.png` });
}

test.describe.configure({ mode: "serial" });

test("README: телефон Орлова", async ({ browser }) => {
  const { ctx, page } = await as(browser, "orlov");
  await page.goto("/today");
  await shot(page, "today");

  await page.goto("/schedule");
  await shot(page, "schedule-change", page.getByTestId("lesson").filter({ hasText: "Перенос" }), 300);

  await page.goto("/schedule?view=month");
  await expect(page.getByTestId("month-grid")).toBeVisible();
  await shot(page, "schedule-month", page.getByRole("heading", { name: "Расписание" }), 90);

  await page.goto("/rating");
  await page.getByRole("button", { name: "на 70" }).click();
  await expect(page.getByTestId("rating-value")).toContainText("71,7");
  await shot(page, "rating-whatif", page.getByRole("heading", { name: "Рейтинг-навигатор" }), 90);

  await page.getByRole("button", { name: "Подать заявление" }).click();
  await expect(page).toHaveURL(/\/requests\/[0-9a-f-]{36}/);
  const requestUrl = page.url().split("?")[0];
  await expect(page.getByTestId("queue-position")).toBeVisible();
  await shot(page, "request-status", page.getByRole("heading", { name: "Заявление на пересдачу" }), 250);

  await page.goto("/notifications");
  await shot(page, "notifications");

  // Без сети: «Учёба» из кэша с пометкой.
  await page.goto("/today");
  await expect(page.locator("html[data-offline-ready='1']")).toHaveCount(1, { timeout: 20_000 });
  await ctx.setOffline(true);
  await page.goto("/grades");
  await expect(page.getByTestId("offline-banner")).toBeVisible();
  await shot(page, "offline");
  await ctx.setOffline(false);
  await ctx.close();

  // Чужая заявка: Соколова открывает адрес заявки Орлова.
  const other = await as(browser, "sokolova");
  await other.page.goto(requestUrl);
  await expect(other.page.getByRole("heading", { name: "Страница не найдена" })).toBeVisible();
  await shot(other.page, "security-404");
  await other.ctx.close();
});

test("README: тёмная тема", async ({ browser }) => {
  const { ctx, page } = await as(browser, "orlov2", PHONE, "dark");
  await page.goto("/rating");
  await shot(page, "dark-rating", page.getByRole("heading", { name: "Рейтинг-навигатор" }), 90);
  await ctx.close();
});

test("README: очередь методиста", async ({ browser }) => {
  const { ctx, page } = await as(browser, "metodist", DESKTOP);
  await page.goto("/staff?f=submitted");
  const item = page.getByTestId("queue-item").filter({ hasText: "Заявление на пересдачу" }).first();
  await item.locator("summary").click();
  await expect(item.getByRole("button", { name: "Взять в работу" })).toBeVisible();
  await shot(page, "staff-queue");
  await ctx.close();
});
