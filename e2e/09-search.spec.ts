import { test, expect } from "@playwright/test";
import { AUTH, sql } from "./helpers";

// Глобальный поиск: находит свои данные и не находит чужие.

test.describe("Соколова, телефон", () => {
  test.use({ storageState: AUTH.a, viewport: { width: 360, height: 800 } });

  test("своя заявка находится и открывается", async ({ page }) => {
    await page.goto("/today");
    await page.getByTestId("search-open").click();
    await page.getByLabel("Что найти").fill("справк обуч");
    const mine = page.locator('[data-testid="search-hit"][data-group="Мои заявки"]');
    await expect(mine.first()).toContainText("Справка об обучении");
    await mine.first().click();
    await expect(page).toHaveURL(/\/requests\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Справка об обучении" })).toBeVisible();
  });

  test("чужие данные не находятся: фамилия и номер заявки однокурсника", async ({ page }) => {
    const [foreign] = await sql<{ number: string }>(
      `select r.number from request r join student s on s.id = r.student_id where s.last_name = 'Орлов' and r.type = 'absence_excuse'`,
    );
    await page.goto("/today");
    await page.getByTestId("search-open").click();
    const input = page.getByLabel("Что найти");

    await input.fill(foreign.number);
    await expect(page.getByTestId("search-empty")).toBeVisible();

    await input.fill("Орлов");
    await expect(page.getByTestId("search-empty")).toBeVisible();

    await input.fill("пропуск");
    await expect(page.locator('[data-testid="search-hit"][data-group="Заказать"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="search-hit"][data-group="Мои заявки"]')).toHaveCount(0);
  });
});

test.describe("Орлов, компьютер", () => {
  test.use({ storageState: AUTH.b, viewport: { width: 1280, height: 800 } });

  test("Ctrl+K, стрелки и Enter: дисциплина с долгом ведёт в план пересдачи", async ({ page }) => {
    await page.goto("/grades");
    await page.keyboard.press("Control+k");
    await page.getByLabel("Что найти").fill("макро");
    const hit = page.locator('[data-testid="search-hit"][data-group="Дисциплины"]').first();
    await expect(hit).toContainText("Макроэкономика");
    await expect(hit).toContainText("долг");
    await hit.click();
    await expect(page).toHaveURL(/\/rating$/);
  });
});
