#!/usr/bin/env node
// Build script for Cloudflare deployment
// Avoids recursion: when called from opennextjs-cloudflare, only runs next build

import { execSync } from "node:child_process"

const isInsideOpenNext = process.env.OPENNEXT_BUILD === "1"

if (isInsideOpenNext) {
  // Called from opennextjs-cloudflare build - only run next build
  console.log("[build] Inside OpenNext — running next build")
  execSync("next build", { stdio: "inherit" })
} else {
  // Called directly - run full build
  console.log("[build] Running prisma + migrations + next build")
  execSync("prisma generate", { stdio: "inherit" })
  execSync("node scripts/migrate-with-retry.mjs", { stdio: "inherit" })
  execSync("next build", { stdio: "inherit" })
}