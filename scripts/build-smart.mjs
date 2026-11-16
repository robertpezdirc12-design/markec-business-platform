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
  // Temporarily hide .env so OpenNext doesn't bake local values into next-env.mjs
  // Cloudflare secrets will be the only source at runtime
  const fs = await import("node:fs")
  const envPath = ".env"
  const envBackup = ".env.cloudflare-backup"
  let envHidden = false
  if (fs.existsSync(envPath)) {
    fs.renameSync(envPath, envBackup)
    envHidden = true
    console.log("[build] .env hidden for Cloudflare build (secrets will be used at runtime)")
  }
  try {
    execSync("npx opennextjs-cloudflare build", {
      stdio: "inherit",
      env: { ...process.env, OPENNEXT_BUILD: "1" },
    })
  } finally {
    if (envHidden && fs.existsSync(envBackup)) {
      fs.renameSync(envBackup, envPath)
      console.log("[build] .env restored")
    }
  }
}