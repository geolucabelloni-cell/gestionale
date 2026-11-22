import { defineConfig } from "@playwright/test";
import "./tests/supporto/ambiente.mjs"; // carica tests/.env.test e blocca i test su database non locali

const PORTA = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/supporto/global-setup.ts",
  fullyParallel: false,
  workers: 1, // i test condividono lo stesso database locale
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORTA}`,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    viewport: { width: 1400, height: 900 },
    trace: "off",
  },
  webServer: [
    {
      command: "node tests/supporto/servizi-finti.mjs",
      url: "http://127.0.0.1:4010/__registro",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run build && npx next start -p ${PORTA}`,
      url: `http://127.0.0.1:${PORTA}/login`,
      timeout: 300_000,
      reuseExistingServer: !process.env.CI,
      env: { ...(process.env as Record<string, string>) },
    },
  ],
});
