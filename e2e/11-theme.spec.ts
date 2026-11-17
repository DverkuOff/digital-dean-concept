import { test, expect } from "@playwright/test";
import { AUTH } from "./helpers";

test.describe("тёмная тема", () => {
  test.use({ storageState: AUTH.b, viewport: { width: 360, height: 800 } });

  test("выбор в профиле сохраняется после перезагрузки, вёрстка 360 px не ломается", async ({ page }) => {
    await page.goto("/profile");
    await page.getByRole("radio", { name: "Тёмная" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    for (const path of ["/today", "/rating", "/schedule?view=week"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveClass(/dark/);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      if (process.env.SCREENSHOTS) await page.screenshot({ path: `docs/screenshots/dark_orlov${path.replace(/[/?=&]+/g, "_")}.png`, fullPage: true });
    }
    await page.goto("/profile");
    await page.getByRole("radio", { name: "Светлая" }).click();
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("«как в системе» следует настройке устройства", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/today");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.emulateMedia({ colorScheme: "light" });
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
});
