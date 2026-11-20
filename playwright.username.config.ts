import { defineConfig, devices } from "@playwright/test"

// ============================================================
// USERNAME LOGIN E2E (migrate 20261129120000_add_username)
// Cilja na ŽE ZAGNAN dev strežnik, ki teče na testni bazi
// (markec-e2e-test-db :5433), kot ga požene:
//
//   node scripts/run-app-test.mjs --port 3002
//
// in se zažene z:
//   set PROJECT_URL=http://localhost:3002 && npx playwright test playwright.username.config.ts
//
// Brez webServer gradnje: producijski build ni nujen za samostojni
// avtentikacijski tok (brez WYSIWYG/dinamičnih modulov); dev +
// obilni timeouti so dovolj in 10-krat hitreji.
// ============================================================

const BASE = process.env.PROJECT_URL || "http://localhost:3002"

export default defineConfig({
  testDir: "./e2e",
  testMatch: /username-login\.spec\.ts/,
  timeout: 300_000,
  expect: { timeout: 30_000 },
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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // No webServer: target the already-running dev server (test DB).
})
