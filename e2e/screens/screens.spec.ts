import { test, expect, type Browser, type Page } from "@playwright/test";
import { login } from "../helpers";

// Скриншоты для docs/screenshots: телефон 360 px и компьютер 1280 px, на свежем демо.
const DIR = "docs/screenshots";
const MOBILE = { width: 360, height: 800 };
const DESKTOP = { width: 1280, height: 860 };

async function as(browser: Browser, username: string | null, viewport = MOBILE, colorScheme: "light" | "dark" = "light") {
  const ctx = await browser.newContext({ viewport, colorScheme, isMobile: viewport.width < 600, hasTouch: viewport.width < 600, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  if (username) {
    await login(page, username);
    await expect(page).not.toHaveURL(/\/login$/);
  }
  return { ctx, page };
}

const shot = async (page: Page, name: string, fullPage = true) => {
  if (fullPage) await page.evaluate(() => window.scrollTo(0, 0)); // иначе липкая шапка попадает в середину снимка
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage });
};

test.describe.configure({ mode: "serial" });

test("вход", async ({ browser }) => {
  for (const [vp, suffix] of [[MOBILE, "360"], [DESKTOP, "1280"]] as const) {
    const { ctx, page } = await as(browser, null, vp);
    await page.goto("/login");
    await shot(page, `login_${suffix}`);
    await ctx.close();
  }
});

test("Орлов, телефон", async ({ browser }) => {
  const { ctx, page } = await as(browser, "orlov");
  for (const [path, name] of [
    ["/today", "orlov_today"],
    ["/schedule", "orlov_schedule_day"],
    ["/schedule?view=week", "orlov_schedule_week"],
    ["/grades", "orlov_grades"],
    ["/rating", "orlov_rating"],
    ["/requests", "orlov_requests"],
    ["/notifications", "orlov_notifications"],
    ["/notifications?tab=news", "orlov_news"],
    ["/profile", "orlov_profile"],
    ["/requests/new", "orlov_requests_new"],
    ["/requests/new?type=absence_excuse", "orlov_request_form"],
  ] as const) {
    await page.goto(path);
    await shot(page, name);
  }
  await page.goto("/requests");
  await page.getByTestId("request-row").filter({ hasText: "Уважительная причина" }).click();
  await shot(page, "orlov_request_returned");
  await page.goto("/requests");
  await page.getByTestId("request-row").filter({ hasText: "военкомата" }).click();
  await shot(page, "orlov_request_transparency");

  // «Что если»: пересдача на 70.
  await page.goto("/rating");
  await page.getByRole("button", { name: "на 70" }).click();
  await shot(page, "orlov_rating_whatif_70");

  await page.goto("/today");
  await page.getByTestId("search-open").click();
  await page.getByLabel("Что найти").fill("макро");
  await expect(page.getByTestId("search-hit").first()).toBeVisible();
  await shot(page, "orlov_search", false);
  await ctx.close();
});

test("Орлов, тёмная тема", async ({ browser }) => {
  const { ctx, page } = await as(browser, "orlov2", MOBILE, "dark");
  for (const [path, name] of [["/today", "dark_orlov_today"], ["/rating", "dark_orlov_rating"]] as const) {
    await page.goto(path);
    await shot(page, name);
  }
  await ctx.close();
});

test("Соколова, телефон", async ({ browser }) => {
  const { ctx, page } = await as(browser, "sokolova");
  for (const [path, name] of [
    ["/today", "sokolova_today"],
    ["/grades", "sokolova_grades"],
    ["/rating", "sokolova_rating"],
    ["/requests", "sokolova_requests"],
  ] as const) {
    await page.goto(path);
    await shot(page, name);
  }
  await ctx.close();
});

test("Методист: телефон и компьютер", async ({ browser }) => {
  for (const [vp, suffix] of [[MOBILE, "360"], [DESKTOP, "1280"]] as const) {
    const { ctx, page } = await as(browser, "metodist", vp);
    await page.goto("/staff");
    await page.getByTestId("queue-item").first().locator("summary").click();
    await shot(page, `metodist_queue_${suffix}`);
    await ctx.close();
  }
});

test("Компьютер 1280 px: студент", async ({ browser }) => {
  const { ctx, page } = await as(browser, "orlov3", DESKTOP);
  for (const [path, name] of [
    ["/today", "desktop_orlov_today"],
    ["/rating", "desktop_orlov_rating"],
    ["/schedule?view=week", "desktop_orlov_schedule_week"],
    ["/requests", "desktop_orlov_requests"],
  ] as const) {
    await page.goto(path);
    await shot(page, name);
  }
  await ctx.close();
});

test("Заметка, календарь и офлайн (меняют данные — снимаем последними)", async ({ browser }) => {
  const { ctx, page } = await as(browser, "sokolova2");
  await page.goto("/schedule?view=week");
  const id = await page.getByTestId("lesson").filter({ has: page.getByTestId("add-note") }).first().getAttribute("data-lesson-id");
  const card = page.locator(`[data-lesson-id="${id}"]`);
  await card.getByTestId("add-note").click();
  await card.getByRole("textbox").fill("Принести эссе по главе 3");
  await card.getByRole("button", { name: "Сохранить" }).click();
  await expect(card.getByTestId("lesson-note")).toBeVisible();
  await card.screenshot({ path: `${DIR}/sokolova_lesson_note.png` });

  await page.goto("/schedule/calendar");
  await page.getByRole("button", { name: "Получить ссылку" }).click();
  await expect(page.getByTestId("calendar-url")).toBeVisible();
  await shot(page, "sokolova_schedule_calendar");

  await page.goto("/requests");
  await page.getByTestId("request-row").filter({ hasText: "Справка об обучении" }).first().click();
  await page.getByLabel("Вопрос учебному офису").fill("Можно забрать справку в субботу?");
  await page.getByRole("button", { name: "Отправить вопрос" }).click();
  await expect(page.getByTestId("message")).toHaveCount(1);
  await shot(page, "sokolova_request_question");

  await page.goto("/today");
  await expect(page.locator("html[data-offline-ready='1']")).toHaveCount(1, { timeout: 20_000 });
  await ctx.setOffline(true);
  await page.goto("/grades");
  await expect(page.getByTestId("offline-banner")).toBeVisible();
  await shot(page, "sokolova_offline_grades", false);
  await ctx.close();
});
