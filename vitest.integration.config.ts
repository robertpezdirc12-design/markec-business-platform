import { defineConfig } from "vitest/config"
import fs from "node:fs"
import path from "path"

// ============================================================
// F2.1 + F2.2 — LOČENA INTEGRACIJSKA SUITA (prava testna baza)
//
//   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/markec_f21_test?schema=public" \
//     node tests/integration/f2-1/seed.mjs
//   npx vitest run --config vitest.integration.config.ts
//
// Namerno ločena od `vitest.config.ts`: običajna enotna/strukturna
// suite ostane brez odvisnosti od baze. Datoteke se imenujejo
// `*.itest.ts`, da jih privzeti `tests/**/*.test.ts` ne pobere.
//
// F5.0.2: suita je zožena na f2-1 + f2-2, ki tečeta na `markec_f21_test`.
// Integracijski testi F2.3/F5.0 tečejo na svoji bazi `markec_f23_test`
// prek `vitest.f23.config.ts` — nikoli ne na f21 (gor. `include`).
//
// VARNOSTNA ZAPORA: ne glede na to, kateri DATABASE_URL je v okolju
// ali v .env, se ime baze vedno prepiše na `markec_f21_test`. Suita
// zato ne more nikoli zadeti produkcijske ali razvojne baze.
// ============================================================

function baseUrl(): string {
  if (process.env.F21_TEST_DATABASE_URL) return process.env.F21_TEST_DATABASE_URL
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const envPath = path.resolve(__dirname, ".env")
  if (fs.existsSync(envPath)) {
    const m = fs
      .readFileSync(envPath, "utf8")
      .match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)
    if (m) return m[1].trim()
  }
  throw new Error(
    "No DATABASE_URL available — set F21_TEST_DATABASE_URL explicitly."
  )
}

const testUrl = baseUrl().replace(/(\/[^/?]+)(\?|$)/, "/markec_f21_test$2")
if (!/\/markec_f21_test(\?|$)/.test(testUrl)) {
  throw new Error("REFUSED: integration suite must target markec_f21_test")
}

export default defineConfig({
  test: {
    include: ["tests/integration/f2-1/**/*.itest.ts", "tests/integration/f2-2/**/*.itest.ts"],
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
