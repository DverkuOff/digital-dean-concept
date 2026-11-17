import { defineConfig, devices } from "@playwright/test";

// E2E-тесты идут против продакшен-сборки на :3100. Перед прогоном база сбрасывается в демо-состояние.
const PORT = 3100;
// Свой «IP клиента» на каждый прогон: лимит входа считается по IP, и повторный прогон
// в ту же минуту не должен упираться в счётчик предыдущего (находка аудита В1).
const RUN_IP = process.env.E2E_CLIENT_IP ?? `10.${(Date.now() >> 16) % 250}.${(Date.now() >> 8) % 250}.${Math.floor(Math.random() * 250) + 1}`;
process.env.E2E_CLIENT_IP = RUN_IP;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["screens/**"],
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
    extraHTTPHeaders: { "X-Forwarded-For": RUN_IP },
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
