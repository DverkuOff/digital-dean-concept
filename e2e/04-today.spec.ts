import { test, expect } from "@playwright/test";
import { AUTH } from "./helpers";

test("«Сегодня»: карточки по правилам, дубль схлопнут, «понял» скрывает карточку", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: AUTH.b, viewport: { width: 360, height: 800 } });
  const page = await ctx.newPage();
  await page.goto("/today");
  const cards = page.getByTestId("today-card");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeLessThanOrEqual(5);

  // Дедлайн «заявление на пересдачу» не отдельной карточкой, а внутри карточки пересдачи.
  const retake = page.locator('[data-testid="today-card"][data-kind="retake"]');
  await expect(retake.first()).toContainText("Сначала: заявление на пересдачу");
  await expect(page.locator('[data-testid="today-card"][data-kind="deadline"]').filter({ hasText: "Заявление на пересдачу" })).toHaveCount(0);

  const first = cards.first();
  const title = (await first.locator("p").first().textContent())!;
  await first.getByRole("button", { name: "Понял" }).click();
  await expect(page.getByTestId("today-card").filter({ hasText: title })).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("today-card").filter({ hasText: title })).toHaveCount(0);
  await ctx.close();
});

test("«Сегодня» у отличницы другое: без пересдач", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: AUTH.a });
  const page = await ctx.newPage();
  await page.goto("/today");
  await expect(page.locator('[data-testid="today-card"][data-kind="retake"]')).toHaveCount(0);
  await expect(page.getByTestId("rating-teaser")).toBeVisible();
  await ctx.close();
});
