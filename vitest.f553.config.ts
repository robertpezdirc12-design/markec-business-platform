import { defineConfig } from "vitest/config"
import fs from "node:fs"
import path from "path"

// ============================================================
// F5.5.3 — UPRAVLJANJE STRANK — LOČENA INTEGRACIJSKA SUITA
// Teče na svoji PRAVI testni bazi `markec_f553_test` (nikoli dev/prod).
// VARNOSTNA ZAPORA: ime baze se vedno prepiše na `markec_f553_test`.
// ============================================================

function baseUrl(): string {
  if (process.env.F553_TEST_DATABASE_URL) return process.env.F553_TEST_DATABASE_URL
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const envPath = path.resolve(__dirname, ".env")
  if (fs.existsSync(envPath)) {
    const m = fs
      .readFileSync(envPath, "utf8")
      .match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)
    if (m) return m[1].trim()
  }
  throw new Error("No DATABASE_URL available — set F553_TEST_DATABASE_URL explicitly.")
}

const testUrl = baseUrl().replace(/(\/[^/?]+)(\?|$)/, "/markec_f553_test$2")
if (!/\/markec_f553_test(\?|$)/.test(testUrl)) {
  throw new Error("REFUSED: F5.5.3 integration suite must target markec_f553_test")
}

export default defineConfig({
  test: {
    include: ["tests/integration/f553/**/*.itest.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: { DATABASE_URL: testUrl },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
})