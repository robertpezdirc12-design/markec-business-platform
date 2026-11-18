#!/usr/bin/env node
// Smart build script for Cloudflare deployment
// Avoids recursion: when called from opennextjs-cloudflare, only runs next build

import { execSync } from "node:child_process"

const isInsideOpenNext = process.env.OPENNEXT_BUILD === "1"
const isWindows = process.platform === "win32"

if (isInsideOpenNext) {
  // Called from opennextjs-cloudflare build — only run next build.
  // The marketplace snapshot was already generated in the outer step (while
  // DATABASE_URL was available); here we just compile it into the bundle.
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

  // Run migrations only in environments where deploy-time migrations are intended.
  // Cloudflare Workers/Pages builds and generic CI do not have DATABASE_URL access
  // and must not run migrations as part of the asset build.
  const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true"
  const isCloudflareBuild =
    process.env.CF_PAGES === "1" ||
    !!process.env.CF_PAGES ||
    !!process.env.WORKERS_CI ||
    !!process.env.CLOUDFLARE_ENV
  if (isCI || isCloudflareBuild) {
    console.log("[build] CI/Cloudflare build detected — skipping migrations (run separately)")
  } else {
    execSync("node scripts/migrate-with-retry.mjs", { stdio: "inherit" })
  }

  // Generate the public marketplace snapshot while DATABASE_URL is still
  // available. This moves the 5 live DB queries off the Worker request path
  // ( Workers Free 10 ms CPU limit → error 1101/1102 ) into build time.
  // The script never fails the build — it writes an empty snapshot if the
  // DB is unreachable, so local/offline builds still succeed.
  console.log("[build] generating marketplace snapshot")
  execSync("node scripts/generate-marketplace-snapshot.mjs", { stdio: "inherit" })

  // Run OpenNext build (internally calls pnpm build → next build via OPENNEXT_BUILD=1)
  // Hide ALL local env files so OpenNext cannot bake secrets (R2 keys,
  // VERCEL_OIDC_TOKEN, DB URLs) into .open-next/cloudflare/next-env.mjs.
  // Cloudflare bindings are the only source of secrets at runtime.
  const fs = await import("node:fs")
  const envFiles = [".env", ".env.local", ".env.production"]
  const hidden = []
  for (const envPath of envFiles) {
    if (!fs.existsSync(envPath)) continue
    const backup = `${envPath}.cloudflare-backup`
    fs.renameSync(envPath, backup)
    hidden.push({ envPath, backup })
  }
  if (hidden.length) {
    console.log(`[build] hidden ${hidden.length} local env file(s) for Cloudflare build`)
  }
  try {
    execSync("npx opennextjs-cloudflare build", {
      stdio: "inherit",
      env: { ...process.env, OPENNEXT_BUILD: "1" },
    })
  } finally {
    for (const { envPath, backup } of hidden.reverse()) {
      if (fs.existsSync(backup)) {
        fs.renameSync(backup, envPath)
        console.log(`[build] restored ${envPath}`)
      }
    }
  }
}