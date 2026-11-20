import { test, expect } from "@playwright/test";
import { AUTH } from "./helpers";

// Вид «Месяц»: сетка Пн–Вс, изменения и пересдача отмечены, клетка ведёт на день, листание ограничено.
test("расписание на месяц у Орлова: изменения, пересдача, переход на день", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: AUTH.b, viewport: { width: 360, height: 800 } });
  const page = await ctx.newPage();
  await page.goto("/schedule");
  await page.getByRole("tab", { name: "Месяц" }).click();
  await expect(page).toHaveURL(/view=month/);
  await expect(page.getByRole("tab", { name: "Месяц" })).toHaveAttribute("aria-selected", "true");

  const grid = page.getByTestId("month-grid");
  await expect(grid).toBeVisible();
  const days = page.getByTestId("month-day");
  expect((await days.count()) % 7).toBe(0);
  await expect(page.locator('[data-testid="month-day"][aria-current="date"]')).toHaveCount(1);
  // В текущем месяце (или в следующем, если сброс в самом конце месяца) есть изменения и пересдача.
  let found = (await page.locator('[data-testid="month-day"][data-has-change]').count()) > 0;
  if (!found) {
    await page.getByRole("link", { name: "Следующий месяц" }).click();
    found = (await page.locator('[data-testid="month-day"][data-has-change]').count()) > 0;
  }
  expect(found).toBe(true);
  await expect(page.getByTestId("month-events")).toBeVisible();

  // Пересдача через 12 дней — в списке своего месяца (текущего или следующего), с названием дисциплины.
  let monthWithRetake = -1;
  for (const m of [0, 1]) {
    await page.goto(`/schedule?view=month&m=${m}`);
    if ((await page.getByTestId("month-events").textContent())?.includes("Пересдача: Макроэкономика")) {
      monthWithRetake = m;
      break;
    }
  }
  expect(monthWithRetake).toBeGreaterThanOrEqual(0);
  const retake = page.locator('[data-testid="month-day"][data-exam="retake"]');
  await expect(retake).toHaveCount(1);

  // Клетка ведёт на день.
  await retake.click();
  await expect(page).toHaveURL(/\/schedule\?d=\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByRole("tab", { name: "День" })).toHaveAttribute("aria-selected", "true");

  // Листание ограничено: от прошлого месяца до сессии; на 360 px без горизонтальной прокрутки.
  await page.goto("/schedule?view=month&m=99");
  await expect(page.getByRole("link", { name: "Следующий месяц" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await ctx.close();
});

test("месяц у Соколовой — её группа, без пересдач", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: AUTH.a, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/schedule?view=month");
  await expect(page.getByTestId("month-grid")).toBeVisible();
  for (const m of [-1, 0, 1, 2]) {
    await page.goto(`/schedule?view=month&m=${m}`);
    await expect(page.getByTestId("month-grid")).toBeVisible();
    await expect(page.locator('[data-testid="month-day"][data-exam="retake"]')).toHaveCount(0);
  }
  await ctx.close();
});
