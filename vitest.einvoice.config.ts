import { defineConfig } from "vitest/config"
import fs from "node:fs"
import path from "node:path"

// F5.5.4.6.2 — ELEKTRONSKI RAČUNI — izolirana baza markec_einvoice_test.
const baseUrl =
  process.env.EINVOICE_TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/markec_einvoice_test?schema=public"
const testUrl = baseUrl.replace(/(\/[^/?]+)(\?|$)/, "/markec_einvoice_test$2")
if (!/\/markec_einvoice_test(\?|$)/.test(testUrl)) {
  throw new Error("REFUSED: e-invoice suite must target markec_einvoice_test")
}

export default defineConfig({
  test: {
    include: ["tests/integration/einvoice/**/*.itest.ts"],
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