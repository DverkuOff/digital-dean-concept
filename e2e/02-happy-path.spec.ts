import { test, expect } from "@playwright/test";
import { AUTH, login } from "./helpers";

// Сквозной путь брифа: войти → расписание и оценки → подать заявку → методист меняет статус → студент видит статус.
test("сквозной путь брифа на телефоне 360 px", async ({ browser }) => {
  const student = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
  const page = await student.newPage();

  await login(page, "orlov");
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("heading", { name: /Максим/ })).toBeVisible();
  await expect(page.getByTestId("concept-banner")).toBeVisible();

  // Расписание: перенос виден
  await page.getByRole("navigation", { name: "Основная навигация" }).getByRole("link", { name: "Расписание" }).click();
  await page.getByRole("tab", { name: "Неделя" }).click();
  await expect(page.locator('[data-testid="lesson"][data-status="moved"]').first()).toBeVisible();
  await expect(page.getByTestId("changes-summary")).toBeVisible();

  // Оценки: «как у меня дела» и долг
  await page.getByRole("link", { name: "Учёба" }).click();
  await expect(page.getByTestId("how-am-i")).toContainText("Есть долг");
  await expect(page.getByTestId("debt-row")).toContainText("Макроэкономика");

  // Подать заявку
  await page.getByRole("link", { name: "Заявки" }).click();
  await page.getByRole("link", { name: "Новая" }).click();
  await page.getByRole("link", { name: /Справка об обучении/ }).click();
  await page.getByLabel(/Куда предоставляется/).fill("Отдел социальной защиты");
  await page.getByLabel(/Формат/).selectOption("Бумажная в учебном офисе");
  await page.getByRole("button", { name: "Подать заявку" }).click();
  await expect(page.getByRole("status")).toContainText("Заявка подана");
  await expect(page.getByTestId("status-badge")).toHaveText("Подана");
  const requestUrl = page.url();
  const number = (await page.getByText(/№ \d{4}-\d{5}/).first().textContent())!.match(/\d{4}-\d{5}/)![0];

  // Методист: взять в работу → готово
  const staffCtx = await browser.newContext({ storageState: AUTH.staff });
  const sp = await staffCtx.newPage();
  await sp.goto("/staff?f=submitted");
  const item = sp.getByTestId("queue-item").filter({ hasText: number });
  await expect(item).toContainText("Орлов Максим");
  await item.locator("summary").click();
  await item.getByRole("button", { name: "Взять в работу" }).click();
  await expect(sp.getByTestId("queue-item").filter({ hasText: number })).toHaveCount(0); // ушла из «Новых»
  await sp.goto("/staff");
  const item2 = sp.getByTestId("queue-item").filter({ hasText: number });
  await item2.locator("summary").click();
  await item2.getByRole("button", { name: "Готово" }).click();
  await expect(item2.getByTestId("status-badge")).toHaveText("Готова");
  await staffCtx.close();

  // Студент видит новый статус, таймлайн и уведомление
  await page.goto(requestUrl.split("?")[0]);
  await expect(page.getByTestId("status-badge")).toHaveText("Готова");
  await expect(page.getByTestId("timeline")).toContainText("В работе");
  await expect(page.getByText(/Забрать в учебном офисе/).first()).toBeVisible();
  await expect(page.getByTestId("bell")).toHaveAttribute("aria-label", /новых/);
  await student.close();
});

test("возвращённая заявка: студент правит поле и подаёт снова", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: AUTH.b });
  const page = await ctx.newPage();
  await page.goto("/requests");
  await page.getByTestId("request-row").filter({ hasText: "Уважительная причина" }).click();
  await expect(page.getByTestId("return-reason")).toContainText("Исправьте дату окончания");
  await expect(page.getByText("Методист просит исправить это поле")).toBeVisible();
  const from = await page.getByLabel(/Пропуск с/).inputValue();
  const d = new Date(from);
  d.setDate(d.getDate() + 2);
  await page.getByLabel(/Пропуск по/).fill(d.toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Исправить и подать снова" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Подана");
  await expect(page.getByTestId("timeline")).toContainText("Исправлена и подана повторно");
  await ctx.close();
});

test("ошибки формы показываются у поля", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: AUTH.a });
  const page = await ctx.newPage();
  await page.goto("/requests/new?type=absence_excuse");
  await page.getByRole("button", { name: "Подать заявку" }).click();
  await expect(page.getByText("Заполните поле").first()).toBeVisible();
  await ctx.close();
});
