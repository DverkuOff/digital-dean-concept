import { test, expect } from "@playwright/test";
import { AUTH } from "./helpers";

// Все экраны на 360 px: без горизонтальной прокрутки, плашка «концепт» на месте.
const STUDENT_PAGES = ["/today", "/schedule", "/schedule?view=week", "/grades", "/rating", "/requests", "/requests/new", "/requests/new?type=absence_excuse", "/notifications", "/notifications?tab=news", "/profile"];

for (const [who, state, pages] of [
  ["sokolova", AUTH.a, STUDENT_PAGES],
  ["orlov", AUTH.b, STUDENT_PAGES],
  ["metodist", AUTH.staff, ["/staff", "/staff?f=all"]],
] as const) {
  test.describe(`360 px · ${who}`, () => {
    test.use({ storageState: state, viewport: { width: 360, height: 800 } });
    for (const path of pages) {
      test(path, async ({ page }) => {
        const res = await page.goto(path);
        expect(res?.status()).toBe(200);
        await expect(page.getByTestId("concept-banner")).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  });
}

test("страница входа на 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/login");
  await expect(page.getByTestId("concept-banner")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
