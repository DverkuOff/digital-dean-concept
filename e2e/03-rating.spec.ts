import { test, expect } from "@playwright/test";
import { AUTH } from "./helpers";

test.describe("рейтинг-навигатор", () => {
  test("отличница: рейтинг, пороги и прогноз сессии", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.a, viewport: { width: 360, height: 800 } });
    const page = await ctx.newPage();
    await page.goto("/rating");
    await expect(page.getByTestId("rating-gauge")).toBeVisible();
    await expect(page.getByTestId("retake-mode")).toHaveCount(0);
    await page.getByRole("checkbox", { name: "учесть" }).check();
    await page.getByRole("button", { name: "Всё на 90" }).click();
    await expect(page.getByTestId("rating-delta")).toBeVisible();
    await expect(page.getByText("условные правила концепта").first()).toBeVisible();
    await ctx.close();
  });

  test("должник: пересдача на 70 открывает стипендию и поднимает место; кнопка создаёт заявку", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.b, viewport: { width: 360, height: 800 } });
    const page = await ctx.newPage();
    await page.goto("/rating");
    const scholarship = page.getByTestId("thresholds").locator("li").filter({ hasText: "Академическая стипендия" });
    await expect(scholarship).toHaveAttribute("data-reached", "false");
    const placeBefore = Number((await page.getByTestId("cohort-place").locator("p").nth(1).textContent())!.match(/\d+/)![0]);

    await expect(page.getByTestId("retake-mode")).toContainText("Осталось попыток: 2");
    await page.getByRole("button", { name: "на 70" }).click();
    await expect(page.getByTestId("retake-value")).toHaveText("70");
    await expect(scholarship).toHaveAttribute("data-reached", "true");
    await expect(page.getByTestId("rating-delta")).toContainText("+");
    const placeAfter = Number((await page.getByTestId("cohort-place").locator("p").nth(1).textContent())!.match(/\d+/)![0]);
    expect(placeAfter).toBeLessThan(placeBefore);

    await page.getByTestId("quick-consultation").click();
    await expect(page).toHaveURL(/\/requests\/[0-9a-f-]+\?created=1/);
    await expect(page.getByRole("heading", { name: "Консультация перед пересдачей" })).toBeVisible();
    await expect(page.getByTestId("status-badge")).toHaveText("Подана");
    await ctx.close();
  });
});
