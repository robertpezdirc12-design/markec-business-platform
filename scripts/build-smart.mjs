#!/usr/bin/env node
// Smart build script for Cloudflare deployment
// Avoids recursion: when called from opennextjs-cloudflare, only runs next build

import { execSync } from "node:child_process"

const isInsideOpenNext = process.env.OPENNEXT_BUILD === "1"
const isWindows = process.platform === "win32"

if (isInsideOpenNext) {
  // Called from opennextjs-cloudflare build — only run next build
  console.log("[build] Inside OpenNext — running next build")
  execSync("next build", { stdio: "inherit" })
} else {
  // Called directly — run full build including OpenNext
  console.log("[build] Running prisma + migrations + OpenNext build")

  // Prisma generate — skip on Windows (EPERM workaround; Linux CI is fine)
  if (isWindows) {
    console.log("[build] Windows detected — skipping prisma generate (use pnpm db:generate manually)")
  } else {
    execSync("prisma generate", { stdio: "inherit" })
  }

  // Run migrations (skips if DATABASE_URL not set)
  execSync("node scripts/migrate-with-retry.mjs", { stdio: "inherit" })

  // Run OpenNext build (internally calls pnpm build → next build via OPENNEXT_BUILD=1)
  execSync("npx opennextjs-cloudflare build", {
    stdio: "inherit",
    env: { ...process.env, OPENNEXT_BUILD: "1" },
  })
}