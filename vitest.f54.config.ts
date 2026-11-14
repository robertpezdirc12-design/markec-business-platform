import { defineConfig } from "vitest/config"
import fs from "node:fs"
import path from "path"

// ============================================================
// F5.4.2 — LOČENA INTEGRACIJSKA SUITA NA markec_f54_test
//
// Večorganizacijsko preverjanje modulov teče na svoji PRAVI testni
// bazi `markec_f54_test` (realni Prisma klient, realne strežniške
// akcije; mockana le seja / next-cache / next-headers).
//
// VARNOSTNA ZAPORA: ime baze se vedno prepiše na `markec_f54_test`.
// Suita ne more nikoli zadeti produkcijske ali razvojne baze.
// ============================================================

function baseUrl(): string {
  if (process.env.F54_TEST_DATABASE_URL) return process.env.F54_TEST_DATABASE_URL
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const envPath = path.resolve(__dirname, ".env")
  if (fs.existsSync(envPath)) {
    const m = fs
      .readFileSync(envPath, "utf8")
      .match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)
    if (m) return m[1].trim()
  }
  throw new Error(
    "No DATABASE_URL available — set F54_TEST_DATABASE_URL explicitly."
  )
}

const testUrl = baseUrl().replace(/(\/[^/?]+)(\?|$)/, "/markec_f54_test$2")
if (!/\/markec_f54_test(\?|$)/.test(testUrl)) {
  throw new Error("REFUSED: F5.4.2 integration suite must target markec_f54_test")
}

export default defineConfig({
  test: {
    include: ["tests/integration/f54/**/*.itest.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: testUrl,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
})