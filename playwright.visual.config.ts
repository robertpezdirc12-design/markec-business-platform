import { defineConfig, devices } from "@playwright/test"
import path from "path"

// ============================================================
// F6.4 — konfiguracija za e2e/visual-editor.spec.ts na DEVERVER
// (izolirana f631 baza). Produkcijska graditev je trenutno blokirana
// s tujim WIP (src/app/actions/einvoices.ts), zato se spec poganja
// proti local `next dev` (reuseExistingServer:true → strežnik mora
// biti že zagnan npr. PORT o podatki).
//
// Env ob zagonu komande:
//   PROJECT_URL=http://localhost:<port>  — naslov dev strežnika
// ============================================================
const PROJECT_URL = process.env.PROJECT_URL || "http://localhost:3012"

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/visual-editor.spec.ts",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: PROJECT_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "sl-SI",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})