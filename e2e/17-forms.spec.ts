import { test, expect } from "@playwright/test";
import { AUTH } from "./helpers";

// ПМИ-2 (Д-15): пустая форма входа не уходит на сервер и не тратит попытку из лимита.
test("пустая форма входа не отправляется", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/auth/")) posts.push(r.url());
  });
  await page.goto("/login");
  await page.getByText("Войти по логину и паролю").click();
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Введите логин и пароль" })).toBeVisible();
  await expect(page.getByLabel("Логин")).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Логин").fill("orlov");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Введите пароль" })).toBeVisible();
  expect(posts).toEqual([]);
});

// ПМИ-2 (Н-19): у пустого выпадающего списка — «Выберите вариант», а не «Заполните поле».
test("пустой «Формат» — просьба выбрать вариант", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: AUTH.a });
  const page = await ctx.newPage();
  await page.goto("/requests/new?type=study_certificate");
  await page.getByLabel(/Куда предоставляется/).fill("Банк");
  await page.getByRole("button", { name: "Подать заявку" }).click();
  await expect(page.locator("#f-format-err")).toHaveText("Выберите вариант");
  await ctx.close();
});
