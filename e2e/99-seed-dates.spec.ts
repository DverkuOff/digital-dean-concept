import { execSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Находка аудита В2: демо, засеянное при деплое, к итогам 28.11 «протухало».
// Сеем базу так, будто сброс был N дней назад, и смотрим, что увидит жюри. Файл идёт последним:
// он пересоздаёт базу (и сессии), а в конце возвращает свежее демо.
const reseed = (daysAgo: number) =>
  execSync("npx tsx scripts/reset.ts", { env: { ...process.env, SEED_DAYS_AGO: String(daysAgo) }, stdio: "ignore" });

test.describe.configure({ mode: "serial" });
test.afterAll(() => reseed(0));

test("через 11 дней после сброса пересдача ещё впереди и видна на «Сегодня»", async ({ page }) => {
  reseed(11);
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page, "orlov3");
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.locator('[data-testid="today-card"][data-kind="retake"]')).toContainText("Пересдача 2");
  await page.goto("/rating");
  await expect(page.getByTestId("retake-mode")).toContainText("Осталось попыток: 2");
  await expect(page.getByTestId("retake-mode")).not.toContainText("назад");
});

test("если дата пересдачи прошла, а результата нет — так и написано", async ({ page }) => {
  reseed(14);
  await login(page, "orlov3");
  await expect(page).toHaveURL(/\/today$/);
  await page.goto("/rating");
  const mode = page.getByTestId("retake-mode");
  await expect(mode).toContainText("результат ещё не внесён");
  await expect(mode).not.toContainText("назад");
  await page.goto("/grades");
  await expect(page.getByTestId("how-am-i")).toContainText("результат ещё не внесён");
});
