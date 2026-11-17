import { test, expect } from "@playwright/test";
import { AUTH } from "./helpers";

// Прозрачность заявки: место в очереди, обычный срок, кто ведёт.
test("новая заявка: место в очереди и срок; после «Взять в работу» видно, кто ведёт", async ({ browser }) => {
  const sctx = await browser.newContext({ storageState: AUTH.b, viewport: { width: 360, height: 800 } });
  const page = await sctx.newPage();
  await page.goto("/requests/new?type=transcript");
  await page.getByLabel(/Язык/).selectOption("Английский");
  await page.getByLabel(/Для чего/).fill("Летняя школа");
  await page.getByRole("button", { name: "Подать заявку" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("Подана");

  const t = page.getByTestId("transparency");
  await expect(t).toContainText("Пока никто: заявка в общей очереди");
  await expect(t).toContainText("Обычно готовят за 4 рабочих дня");
  const qp = page.getByTestId("queue-position");
  const [p, total] = [Number(await qp.getAttribute("data-position")), Number(await qp.getAttribute("data-total"))];
  expect(p).toBe(total); // новая заявка — последняя в очереди
  await expect(qp).toContainText(`Перед вами ${p - 1}`);
  const number = (await page.getByText(/№ \d{4}-\d{5}/).first().textContent())!.match(/\d{4}-\d{5}/)![0];

  const staff = await browser.newContext({ storageState: AUTH.staff });
  const sp = await staff.newPage();
  await sp.goto("/staff?f=submitted");
  const item = sp.getByTestId("queue-item").filter({ hasText: number });
  await item.locator("summary").click();
  await item.getByRole("button", { name: "Взять в работу" }).click();
  await expect(sp.getByTestId("queue-item").filter({ hasText: number })).toHaveCount(0);
  await staff.close();

  await page.reload();
  await expect(page.getByTestId("status-badge")).toHaveText("В работе");
  await expect(t).toContainText("Ирина Сафонова");
  await expect(page.getByTestId("queue-position")).toHaveCount(0);
  await sctx.close();
});
