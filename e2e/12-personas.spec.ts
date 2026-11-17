import { test, expect } from "@playwright/test";
import { sql } from "./helpers";

// Демо для многих экспертов: кнопки «Войти как…» и независимые копии персонажей.
test("кнопка «Войти как Орлов, копия 2» и независимость копий", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByRole("button", { name: "Войти как Максим Орлов, копия 2" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("heading", { name: /Максим/ })).toBeVisible();

  // Копия 2 исправляет возвращённую заявку…
  await page.goto("/requests");
  await page.getByTestId("request-row").filter({ hasText: "Уважительная причина" }).click();
  await page.getByRole("button", { name: "Исправить и подать снова" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Подана");
  await ctx.close();

  // …а у копии 3 она по-прежнему возвращена (основного Орлова уже «потрогали» другие тесты).
  const rows = await sql<{ username: string; status: string }>(
    `select u.username, r.status from request r join student s on s.id = r.student_id join "user" u on u.id = s.user_id
     where r.type = 'absence_excuse' and u.username in ('orlov2', 'orlov3') order by u.username`,
  );
  expect(rows).toEqual([
    { username: "orlov2", status: "submitted" },
    { username: "orlov3", status: "returned" },
  ]);
});

test("кнопка «Войти» методиста ведёт в очередь", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Войти как Методист учебного офиса", exact: true }).click();
  await expect(page).toHaveURL(/\/staff$/);
});
