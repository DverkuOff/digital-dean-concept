import { defineConfig, devices } from "@playwright/test";

// Съёмка скриншотов для описания процесса: `npm run screens`.
// База сбрасывается перед съёмкой, персонажи «нетронутые» — сюжет виден целиком.
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;
process.env.E2E_CLIENT_IP ??= `10.200.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`;

export default defineConfig({
  testDir: "./e2e/screens",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    channel: process.env.PW_CHANNEL || undefined,
    baseURL,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    extraHTTPHeaders: { "X-Forwarded-For": process.env.E2E_CLIENT_IP },
  },
  projects: [{ name: "screens", use: { ...devices["Desktop Chrome"], channel: process.env.PW_CHANNEL || undefined } }],
  webServer: { command: "npm run build && npm run start", url: `${baseURL}/login`, reuseExistingServer: true, timeout: 240_000 },
});
