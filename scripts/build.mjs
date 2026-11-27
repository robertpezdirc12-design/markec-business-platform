#!/usr/bin/env node
// Production build for the Vercel target.
//
// Order matters:
//   1. prisma generate       — the client must exist before `next build` type-checks
//   2. migrations            — the schema must be ahead of the deploy (skipped on CI build checks)
//   3. marketplace snapshot  — public data is baked into the bundle (fail-soft)
//   4. next build            — the deployable artifact

import { execSync } from "node:child_process"

const isWindows = process.platform === "win32"
const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true"

// Prisma generate — skip on Windows (EPERM workaround; Linux CI and Vercel are fine)
if (isWindows) {
  console.log("[build] Windows detected — skipping prisma generate (use `pnpm db:generate` manually)")
} else {
  execSync("prisma generate", { stdio: "inherit" })
}

// Deploy-time migrations need a real database. CI build checks run against a
// fake DATABASE_URL, so they must not try to migrate anything.
if (isCI) {
  console.log("[build] CI build detected — skipping migrations (they run before the deploy)")
} else {
  execSync("node scripts/migrate-with-retry.mjs", { stdio: "inherit" })
}

// The public marketplace reads a build-time snapshot instead of hitting the DB
// per request. The generator never fails the build: an unreachable database
// produces an empty snapshot and a warning.
console.log("[build] generating marketplace snapshot")
execSync("node scripts/generate-marketplace-snapshot.mjs", { stdio: "inherit" })

console.log("[build] next build")
execSync("next build", { stdio: "inherit" })
