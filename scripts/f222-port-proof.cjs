// ============================================================
// F2.2.2 P1-6 — PORT PROOF (:3001 against markec_dev)
//
//   Prereq:
//     1) dev server on :3001 (NEXTAUTH_URL/NEXT_PUBLIC_APP_URL S Tirni
//        na :3000 — namerno, tako radiodramatiziran iz .env) :
//        $env:DATABASE_URL = ".../markec_dev"
//        npx next dev -p 3001
//     2) THIS script runs against :3001:
//        $env:DATABASE_URL = ".../markec_dev"
//        node scripts/f222-port-proof.cjs
//
// Proverja (brez spreminčanja .env / nasvidanje NEXTAUTH_URL):
//   1) anonimen GET /workspaces/manage na :3001 → redirect ostane na
//      ISTEM portu (:3001/login), ne :3000
//   2) prijava admin na :3001 deluje (trustHost dev pravilo)
//   3) tenant resolucija na :3001: /s/demo-salon pokaže najemnika
//      (ne platforme) — loopback origin preference v praksi
//   4) luxury service picker na :3001 deluje
// ============================================================

const { chromium } = require("@playwright/test")
const { PrismaClient } = require("@prisma/client")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const BASE = "http://localhost:3001"
const ADMIN = "admin@rcbeautysalon.org"
const ADMIN_PW = process.env.SEED_ADMIN_PASSWORD || "admin123"
const OUT_DIR = path.join(os.tmpdir(), "markec-f222")
const SHOTS = path.join(OUT_DIR, "shots")

const dbUrl = process.env.DATABASE_URL || ""
if (!/^postgresql:\/\/[^@]*@[^/]+\/markec_dev(\?|$)/.test(dbUrl)) {
  console.error("REFUSED: DATABASE_URL must point to markec_dev")
  process.exit(1)
}
const prisma = new PrismaClient()
const results = []
function record(name, ok, detail) {
  const row = { name, ok: !!ok, detail: String(detail ?? "").slice(0, 400) }
  results.push(row)
  console.log(`${ok ? "PASS" : "FAIL"} | ${name} | ${row.detail.slice(0, 220)}`)
}

async function waitHydrated(page) {
  await page.waitForFunction(
    () =>
      Object.getOwnPropertyNames(document.body).some((k) => k.startsWith("__reactProps$")),
    null,
    { timeout: 120000 }
  )
}

;(async () => {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } })
  ctx.setDefaultTimeout(120000)
  ctx.setDefaultNavigationTimeout(120000)
  const page = await ctx.newPage()
  const errs = []
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()) })
  page.on("pageerror", (e) => errs.push(e.message))

  try {
    // 1) anonimen /workspaces/manage → /login na ISTEM portu
    await page.goto(`${BASE}/workspaces/manage`, { waitUntil: "domcontentloaded" })
    await page.waitForFunction(
      () => location.pathname.startsWith("/login"),
      null,
      { timeout: 120000 }
    )
    record(
      "P1 anonimen na :3001 → /login ISTI port (ne :3000)",
      page.url().includes("localhost:3001"),
      page.url()
    )

    // 2) prijava admin na :3001
    await waitHydrated(page)
    await page.locator("#email").fill(ADMIN)
    await page.locator("#password").fill(ADMIN_PW)
    await page.locator('button[type="submit"]').click()
    await page.waitForFunction(
      () => !location.pathname.startsWith("/login"),
      null,
      { timeout: 120000 }
    )
    record(
      "P2 prijava admin na :3001 deluje",
      !page.url().startsWith(`${BASE}/login`) && page.url().includes("3001"),
      page.url()
    )
    await waitHydrated(page)
    await page.goto(`${BASE}/workspaces/manage`, { waitUntil: "domcontentloaded" })
    await waitHydrated(page)
    const manageText = await page.locator("body").innerText()
    record(
      "P3 /workspaces/manage pokaže uporabniške namige",
      manageText.trim().length > 100,
      `len=${manageText.length}`
    )
    await page.screenshot({ path: path.join(SHOTS, "p3-manage-3001.png") })

    // 3) tenant resolucija na :3001
    await page.goto(`${BASE}/s/demo-salon`, { waitUntil: "domcontentloaded" })
    await waitHydrated(page)
    const tenantHome = await page.locator("body").innerText()
    record(
      "P4 tenant /s/demo-salon na :3001",
      tenantHome.includes("harmonija") || tenantHome.includes("Salon"),
      `len=${tenantHome.length} napake=${errs.length}`
    )
    await page.screenshot({ path: path.join(SHOTS, "p4-tenant-3001.png") })

    // 4) booking service picker na :3001
    await page.goto(`${BASE}/s/demo-salon/booking`, { waitUntil: "domcontentloaded" })
    await waitHydrated(page)
    await page.waitForSelector('a[href*="/booking?service="]', { timeout: 60000 })
    const links = await page.locator('a[href*="/booking?service="]').count()
    record("P5 booking service picker na :3001", links >= 3, `links=${links}`)

    record("P6 brez konzolnih napak na :3001", errs.length === 0, errs.slice(0, 3).join(" | ") || "0 napak")
  } catch (err) {
    record("NEPRIČAKOVANA NAPAKA", false, err.message)
    await page.screenshot({ path: path.join(SHOTS, "port-proof-error.png") }).catch(() => {})
  } finally {
    await browser.close()
    await prisma.$disconnect()
  }
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} PASS`)
  process.exit(failed ? 1 : 0)
})()
