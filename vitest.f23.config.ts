import { defineConfig } from "vitest/config"
import fs from "node:fs"
import path from "path"

// ============================================================
// F2.3.1 — LOČENA INTEGRACIJSKA SUITA NA markec_f23_test
//
// Namerno ločena od `vitest.integration.config.ts` (F2.1/F2.2 -> f21_test)
// in od `vitest.config.ts`: F2.3.1 Staff multi-org teče na svoji PRAVA
// testni bazi `markec_f23_test`, kot zahteva arhitektura (§2.4 — ločena
// testna baza, nikoli markec_dev / produkcija).
//
// VARNOSTNA ZAPORA: ime baze se vedno prepiše na `markec_f23_test`.
// ============================================================

function baseUrl(): string {
  if (process.env.F23_TEST_DATABASE_URL) return process.env.F23_TEST_DATABASE_URL
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const envPath = path.resolve(__dirname, ".env")
  if (fs.existsSync(envPath)) {
    const m = fs
      .readFileSync(envPath, "utf8")
      .match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)
    if (m) return m[1].trim()
  }
  throw new Error(
    "No DATABASE_URL available — set F23_TEST_DATABASE_URL explicitly."
  )
}

const testUrl = baseUrl().replace(/(\/[^/?]+)(\?|$)/, "/markec_f23_test$2")
if (!/\/markec_f23_test(\?|$)/.test(testUrl)) {
  throw new Error("REFUSED: F2.3.1 integration suite must target markec_f23_test")
}

export default defineConfig({
  test: {
    include: ["tests/integration/f2-3/**/*.itest.ts"],
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