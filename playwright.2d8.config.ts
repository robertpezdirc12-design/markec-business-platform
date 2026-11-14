import { defineConfig, devices } from "@playwright/test"

// ============================================================
// 2D-8 — izvedi Playwright E2E proti ŽE PRIŽGAtemu dev strežniku
// (testna baza markec_e2e_test). Ne gradimo produkcije (tuji WIP
// einvoices blokira `next build`), zato webServer ni določen — test
// predpostavi, da strežnik teče (koordinator ga požene s :
//
//   set DATABASE_URL=...markec_e2e_test... && npx next dev -p 3002
//
// in ta konfiguracija teče z:
//   PROJECT_URL=http://localhost:3002 npx playwright test playwright.2d8.config.ts
// ============================================================

const BASE = process.env.PROJECT_URL || "http://localhost:3002"

export default defineConfig({
  testDir: "./e2e",
  testMatch: /2d(8|9|10|11|12|13)-.*\.spec\.ts/,
  timeout: 300_000,
  expect: { timeout: 25_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "sl-SI",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // No webServer: we target the already-running :3002 dev server.
})