import { defineConfig, devices } from "@playwright/test";

// E2E-тесты идут против продакшен-сборки на :3100. Перед прогоном база сбрасывается в демо-состояние.
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    // Браузер: Chromium из `npx playwright install chromium` или установленный Chrome (PW_CHANNEL=chrome).
    channel: process.env.PW_CHANNEL || undefined,
    baseURL,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "mobile-360",
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"], channel: process.env.PW_CHANNEL || undefined, viewport: { width: 360, height: 800 } },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: `${baseURL}/login`,
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
