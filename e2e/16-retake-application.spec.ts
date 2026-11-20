import { test, expect } from "@playwright/test";
import { AUTH, login, sql } from "./helpers";

// ПМИ-2 (Н-2, Н-10): заявление на пересдачу дошло до «Готово» — «Сегодня» говорит «вы в ведомости»,
// а обычная форма не даёт подать второе заявление по той же дисциплине.
// Персонаж orlov2: файлы 13 и 14 с ним уже отработали, после этого файла — только пересев в 99.
test("готовое заявление на пересдачу: «Сегодня» не просит подать снова, форма не создаёт дубль", async ({ browser }) => {
  const sctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await sctx.newPage();
  await login(page, "orlov2");
  await expect(page).toHaveURL(/\/today$/);

  const count = () =>
    sql<{ n: number }>(
      `select count(*)::int as n from request r join student s on s.id = r.student_id join "user" u on u.id = s.user_id
       where u.username = 'orlov2' and r.type = 'retake_application'`,
    ).then((r) => r[0].n);

  // Файл 13 упирает orlov2 в лимит 10 активных заявок — освобождаем место (не предмет этого теста).
  await sql(
    `update request set status = 'rejected' where payload->>'purpose' like 'Параллельно %'
       and student_id = (select s.id from student s join "user" u on u.id = s.user_id where u.username = 'orlov2')`,
  );

  // Подаём из рейтинга.
  await page.goto("/rating");
  await page.getByRole("button", { name: "Подать заявление" }).click();
  await expect(page).toHaveURL(/\/requests\/[0-9a-f-]{36}/);
  const number = (await page.getByText(/№ \d{4}-\d{5}/).first().textContent())!.match(/\d{4}-\d{5}/)![0];
  expect(await count()).toBe(1);

  // Методист: в работу → готово.
  const staff = await browser.newContext({ storageState: AUTH.staff });
  const sp = await staff.newPage();
  await sp.goto("/staff?f=submitted");
  const item = sp.getByTestId("queue-item").filter({ hasText: number });
  await item.locator("summary").click();
  await item.getByRole("button", { name: "Взять в работу" }).click();
  await expect(sp.getByTestId("queue-item").filter({ hasText: number })).toHaveCount(0);
  await sp.goto("/staff");
  const item2 = sp.getByTestId("queue-item").filter({ hasText: number });
  await item2.locator("summary").click();
  await item2.getByRole("button", { name: "Готово" }).click();
  await expect(item2.getByTestId("status-badge").filter({ visible: true })).toHaveText("Готова");
  // У готового заявления «закрыть», а не «выдана»: забирать нечего.
  await expect(item2.getByRole("button", { name: "Закрыть заявку" })).toBeVisible();
  await staff.close();

  // Текст «готово» — про ведомость, а не «забрать с паспортом».
  await page.reload();
  await expect(page.getByTestId("status-badge")).toHaveText("Готова");
  await expect(page.getByText(/ведомост/).first()).toBeVisible();
  await expect(page.getByText(/с паспортом/)).toHaveCount(0);

  // «Сегодня»: карточка пересдачи знает, что заявление принято.
  await page.goto("/today");
  const retake = page.locator('[data-testid="today-card"][data-kind="retake"]');
  await expect(retake).toContainText("Заявление принято: вы в ведомости пересдачи");
  await expect(page.getByRole("link", { name: "Подать заявление" })).toHaveCount(0);

  // Обычная форма: второе заявление по той же дисциплине не создаётся.
  await page.goto("/requests/new?type=retake_application");
  await page.getByLabel(/Дисциплина/).fill("Макроэкономика");
  await page.getByLabel(/Что нужно/).selectOption("Записаться на ближайшую пересдачу");
  await page.getByRole("button", { name: "Подать заявку" }).click();
  const alert = page.locator("form").getByRole("alert");
  await expect(alert).toContainText(`Заявление по этой дисциплине уже подано: № ${number}`);
  await expect(alert.getByRole("link")).toHaveAttribute("href", /\/requests\/[0-9a-f-]{36}$/);
  expect(await count()).toBe(1);
  await sctx.close();
});

// ПМИ-2 (Д-17): пустая причина возврата отклоняется сервером, а не только атрибутом required в браузере.
test("возврат без причины (пробелы, в обход браузерной проверки) не проходит", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: AUTH.staff });
  const page = await ctx.newPage();
  await page.goto("/staff?f=submitted");
  const item = page.getByTestId("queue-item").first();
  const id = (await item.getAttribute("data-request-id"))!;
  await item.locator("details").evaluate((el) => ((el as HTMLDetailsElement).open = true));
  await item.getByRole("button", { name: "Вернуть с причиной" }).click();
  const reason = item.getByLabel(/Причина возврата/);
  await reason.evaluate((el) => el.removeAttribute("required"));
  await reason.fill("   ");
  await item.getByRole("button", { name: "Вернуть с причиной" }).click();
  await expect(item.getByRole("alert")).toContainText("Напишите причину");
  const [row] = await sql<{ status: string }>("select status from request where id = $1", [id]);
  expect(row.status).toBe("submitted");
  await ctx.close();
});

// ПМИ-2 (Д-12): методист видит, какое поле отмечено при возврате.
test("в очереди у возвращённой заявки видно отмеченное поле", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: AUTH.staff });
  const page = await ctx.newPage();
  await page.goto("/staff?f=returned");
  const item = page.getByTestId("queue-item").filter({ hasText: "Уважительная причина" }).first();
  await item.locator("details").evaluate((el) => ((el as HTMLDetailsElement).open = true));
  await expect(item.getByTestId("return-info")).toContainText("Студента попросили исправить: Пропуск по");
  await ctx.close();
});
