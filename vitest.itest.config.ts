import { defineConfig } from "vitest/config"
import path from "path"

// Ločena konfiguracija za integracijske (E2E-DB) varnostne teste — pogosto se
// poganja ROČNO z izrecno DATABASE_URL na izolirani bazi (npr.
//   set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/markec_f631_test?schema=public
//   npx vitest run --config vitest.itest.config.ts
// ). NIKOLI se ne poganja skozi `npm test` (ki uporablja `vitest.config.ts`),
// da slučajno ne udari markec_dev/produkcije.
export default defineConfig({
  test: {
    include: ["tests/**/*.itest.ts"],
    environment: "node",
    testTimeout: 60000,
    hookTimeout: 60000,
    // Idempotentni f631 fixtureji (org + owner uporabniki) pred zagonom —
    // vidno v tests/integration/itest-global-setup.ts.
    globalSetup: ["tests/integration/itest-global-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
})