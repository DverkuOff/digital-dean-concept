import { test as setup, expect } from "@playwright/test";
import { AUTH, login } from "./helpers";

for (const [key, username, landing] of [
  ["a", "sokolova", "/today"],
  ["b", "orlov", "/today"],
  ["staff", "metodist", "/staff"],
] as const) {
  setup(`вход: ${username}`, async ({ page }) => {
    await login(page, username);
    await expect(page).toHaveURL(new RegExp(`${landing}$`));
    await page.context().storageState({ path: AUTH[key] });
  });
}
