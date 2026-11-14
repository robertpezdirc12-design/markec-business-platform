// ============================================================
// MARKEC — zag Steps Next.js app na IZOLIRANI testni bazi (2D-1G).
//
//   node scripts/run-app-test.mjs [--port 3002]
//
// 1. Prebere testni DATABASE_URL iz .env.test.
// 2. Požene strogi scripts/test-db-guard.mjs (fail-closed).
// 3. Zažene Next dev na danem portu z DATABASE_URL nastavljeno na testno bazo.
//    NIKOLI ne prepisuje .env; običajni dev ukazi in .env ostanejo nespremenjeni.
// ============================================================

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { spawn, spawnSync } from "node:child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const portIdx = process.argv.indexOf("--port")
const port = portIdx >= 0 ? process.argv[portIdx + 1] : "3002"

let url = process.env.DATABASE_URL
let nextAuthUrl = process.env.NEXTAUTH_URL
{
  const envFile = readFileSync(resolve(root, ".env.test"), "utf8")
  const dbm = envFile.match(/^DATABASE_URL\s*=\s*"([^"]+)"/m) || envFile.match(/^DATABASE_URL\s*=\s*'([^']+)'/m)
  const nm = envFile.match(/^NEXTAUTH_URL\s*=\s*"([^"]+)"/m) || envFile.match(/^NEXTAUTH_URL\s*=\s*'([^']+)'/m)
  if (!url && dbm) url = dbm[1]
  if (!nextAuthUrl && nm) nextAuthUrl = nm[1]
}
if (!url) {
  console.error("[run-app-test] Ni DATABASE_URL niti v .env.test.")
  process.exit(1)
}

// Fail-closed guard (strogi).
const guard = spawnSync(process.execPath, [resolve(root, "scripts/test-db-guard.mjs")], {
  env: { ...process.env, DATABASE_URL: url },
  stdio: "inherit",
  cwd: root,
})
if (guard.status !== 0) {
  process.exit(guard.status ?? 2)
}

// Zaženi Next dev z DATABASE_URL (in brez DIRECT_URL) na testni bazi.
const nextEntry = resolve(root, "node_modules/next/dist/bin/next")
const child = spawn(process.execPath, [nextEntry, "dev", "--turbopack", "--port", port], {
  env: {
    ...process.env,
    DATABASE_URL: url,
    NEXTAUTH_URL: nextAuthUrl || `http://localhost:${port}`,
    // Če bi kateri koli DIRECT_URL bil nastavljen v okolju, ga pri testni
    // aplikaciji onemogočimo — operacije naj gredo samo na testno bazo.
    DIRECT_URL: undefined,
    PORT: port,
  },
  stdio: "inherit",
  cwd: root,
})
child.on("exit", (code) => process.exit(code ?? 1))