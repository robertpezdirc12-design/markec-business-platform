// ============================================================
// MARKEC — pomočnik za zagon ukazov nad IZOLIRANO testno bazo.
//
// Uporaba:
//   node scripts/run-with-test-db.mjs <ukaz> [args...]
//
// 1. Prebere testno DATABASE_URL iz okolja, sicer iz .env.test.
// 2. Požene scripts/test-db-guard.mjs (fail-closed: zavrne markec_dev/prod).
// 3. Nastavi DATABASE_URL v podizvajalcu in izvede ukaz.
// 4. Ne spreminja .env in ne sveti skrivnosti.
//
// Primeri (iz package.json):
//   test:db:migrate -> run-with-test-db prisma migrate deploy
//   test:itest      -> run-with-test-db vitest run --config vitest.itest.config.ts
// ============================================================

import { spawn, spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const [cmd, ...args] = process.argv.slice(2)

// Preberi testni DATABASE_URL (okolje ima prednost; sicer .env.test).
let url = process.env.DATABASE_URL
if (!url) {
  const envFile = readFileSync(resolve(root, ".env.test"), "utf8")
  const m = envFile.match(/^DATABASE_URL\s*=\s*"([^"]+)"/m) || envFile.match(/^DATABASE_URL\s*=\s*'([^']+)'/m)
  if (!m) {
    console.error("[run-with-test-db] Ni DATABASE_URL niti v .env.test.")
    process.exit(1)
  }
  url = m[1]
}

// Fail-closed guard: mora biti testna baza (_test / markec_e2e_test).
const guard = spawnSync(process.execPath, [resolve(root, "scripts/test-db-guard.mjs")], {
  env: { ...process.env, DATABASE_URL: url },
  cwd: root,
  stdio: "inherit",
})
if (guard.status !== 0) {
  process.exit(guard.status ?? 2)
}

if (!cmd) {
  console.error("[run-with-test-db] Ni ukaza. Npr. `node scripts/run-with-test-db.mjs prisma migrate deploy`.")
  process.exit(1)
}

// Lokalne binarne programe (prisma, vitest, tsx, playwright) zaženi nekoerkt
// nepremočno prek njihove JS vstopne točke (process.execPath), da se izognemo
// .cmd shimom in shell-concat tveganju na Windows.
const localBins = {
  prisma: resolve(root, "node_modules/prisma/build/index.js"),
  vitest: resolve(root, "node_modules/vitest/vitest.mjs"),
  tsx: resolve(root, "node_modules/tsx/dist/cli.mjs"),
  playwright: resolve(root, "node_modules/@playwright/test/cli.js"),
}
const entry = localBins[cmd]
const finalArgs = entry ? [entry, ...args] : []
const spawnCmd = entry ? process.execPath : cmd

const child = spawn(spawnCmd, finalArgs, {
  env: { ...process.env, DATABASE_URL: url },
  stdio: "inherit",
  shell: false,
})
child.on("exit", (code) => process.exit(code ?? 1))