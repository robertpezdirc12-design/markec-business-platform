import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // isolate: false deli en V8 isolator med testnimi datotekami → ~40 %
    // hitrejši zagon (vsaka datoteka prej dobila svoj isolator). Testi so
    // med seboj neodvisni (brez skupne modulske state), zato je varno.
    isolate: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Next.js resolves the "server-only" guard package internally;
      // under vitest it must be aliased to a no-op stub so server
      // libraries (domains provider, tenant resolver) stay testable.
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
})
