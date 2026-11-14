// ============================================================
// F2.1 — REAL USER FLOW (Playwright + real NextAuth + real test DB)
//
// PREREQUISITES (never production):
//   1. `markec_f21_test` exists and is seeded:
//        DATABASE_URL="postgresql://.../markec_f21_test?schema=public" \
//          node tests/integration/f2-1/seed.mjs
//   2. A dev server is running against THAT SAME database:
//        DATABASE_URL="postgresql://.../markec_f21_test?schema=public" \
//          npx next dev -p 3001 -H 127.0.0.1
//   3. Run:
//        F21_BASE_URL=http://127.0.0.1:3001 \
//        DATABASE_URL="postgresql://.../markec_f21_test?schema=public" \
//          node tests/integration/f2-1/browser-flow.cjs
//
// Writes screenshots + JSON results to F21_OUT_DIR (default: OS tmpdir).
// Hard guard: refuses any DATABASE_URL that is not `markec_f21_test`.
// ============================================================

const { chromium } = require("@playwright/test")
const { PrismaClient } = require("@prisma/client")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const BASE = process.env.F21_BASE_URL || "http://127.0.0.1:3001"
const PW = process.env.F21_TEST_PASSWORD || "F21test!2026"
const OUT_DIR = process.env.F21_OUT_DIR || path.join(os.tmpdir(), "markec-f21")
const SHOTS = path.join(OUT_DIR, "browser-flow")
const OUT = path.join(OUT_DIR, "browser-flow-results.json")
const ID = { A: "f21-org-a", B: "f21-org-b" }

const dbUrl = process.env.DATABASE_URL || ""
if (!/^postgresql:\/\/[^@]*@[^/]+\/markec_f21_test(\?|$)/.test(dbUrl)) {
  console.error("REFUSED: DATABASE_URL must point to markec_f21_test")
  process.exit(1)
}
const prisma = new PrismaClient()

const results = []
function record(name, ok, detail) {
  const row = { name, ok: !!ok, detail: String(detail ?? "") }
  results.push(row)
  console.log(`${ok ? "PASS" : "FAIL"} | ${name} | ${row.detail}`)
}

async function waitHydrated(page) {
  // In dev mode the client chunks attach after DOMContentLoaded. Submitting
  // before hydration causes a NATIVE GET with credentials in the URL.
  await page.waitForFunction(
    () => Object.getOwnPropertyNames(document.body).some((k) => k.startsWith("__reactProps$")),
    null,
    { timeout: 180000 }
  )
}
async function dbOrg(email) {
  const u = await prisma.user.findUnique({ where: { email }, select: { organizationId: true } })
  return u?.organizationId ?? null
}
async function sessionUser(page) {
  const res = await page.request.get(`${BASE}/api/auth/session`)
  const body = await res.json().catch(() => null)
  return body?.user ?? null
}
async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" })
  await waitHydrated(page)
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(PW)
  await page.locator('button[type="submit"]').click()
  // App Router soft-navigations don't fire Playwright navigation events,
  // so poll window.location instead of waitForURL.
  await page.waitForFunction(() => !location.pathname.startsWith("/login"), null, { timeout: 180000 })
  await page.locator("body").waitFor({ state: "attached", timeout: 60000 })
}
async function cards(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[role="group"][aria-label]')].map((el) => ({
      name: el.getAttribute("aria-label"),
      button: el.querySelector("button")?.innerText?.trim() ?? null,
      disabled: el.querySelector("button")?.disabled ?? null,
      active: el.innerText.includes("Zadnji uporabljeni"),
    }))
  )
}
async function enterCard(page, nameContains, expectPath = "/dashboard") {
  const card = page.locator('[role="group"][aria-label]').filter({ hasText: nameContains })
  // After a full page.goto the board re-hydrates; clicking before React
  // attaches the handler does nothing. Wait for hydration first.
  await waitHydrated(page)
  await card.getByRole("button").click()
  // The picker opens the ROLE-CORRECT surface: ADMIN -> /dashboard,
  // STAFF -> /staff-portal. Wait for that, not a hard-coded /dashboard.
  await page.waitForFunction(
    (p) => location.pathname.startsWith(p),
    expectPath,
    { timeout: 180000 }
  )
  await page.locator("body").waitFor({ state: "attached", timeout: 60000 })
  return page.locator("body").innerText({ timeout: 30000 }).catch(() => "")
}

;(async () => {
  fs.mkdirSync(SHOTS, { recursive: true })
  // Deterministic starting point for the last-used workspace.
  await prisma.user.update({ where: { id: "f21-user-admin" }, data: { organizationId: ID.A } })
  await prisma.user.update({ where: { id: "f21-user-staff" }, data: { organizationId: ID.A } })

  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } })
  ctx.setDefaultTimeout(180000)
  ctx.setDefaultNavigationTimeout(180000)
  const page = await ctx.newPage()
  try {
    // 0 — anonymous guard
    await page.goto(`${BASE}/workspaces`, { waitUntil: "domcontentloaded" })
    await page.waitForFunction(() => location.pathname.startsWith("/login"), null, { timeout: 180000 })
    record("anonymous /workspaces redirects to /login", page.url().includes("/login"), page.url())

    // 1 — real credentials login -> two-workspace board
    await login(page, "admin@f21.test")
    record("ADMIN real login lands on /workspaces", page.url().includes("/workspaces"), page.url())
    const c0 = await cards(page)
    record("board shows exactly 2 workspaces", c0.length === 2, JSON.stringify(c0.map((c) => c.name)))
    const active0 = c0.find((c) => c.active)
    record("A is last-used (active) on first login", !!active0 && active0.name.includes("(A)"), active0?.name ?? "none")
    record("active card is enterable", !!active0 && active0.disabled === false, active0?.button ?? "n/a")
    record("DB last-used = org A after login", (await dbOrg("admin@f21.test")) === ID.A, await dbOrg("admin@f21.test"))
    const s0 = await sessionUser(page)
    record("JWT session carries org A", s0?.organizationId === ID.A, JSON.stringify(s0))
    await page.screenshot({ path: path.join(SHOTS, "01-board-A.png"), fullPage: true })

    // 2 — direct active workspace entry
    const dash0 = await enterCard(page, "(A)")
    record("active card opens /dashboard", page.url().includes("/dashboard"), page.url())
    record("dashboard renders without an error overlay", !/Application error|Internal Server Error/i.test(dash0), dash0.slice(0, 100).replace(/\s+/g, " "))
    await page.screenshot({ path: path.join(SHOTS, "02-dashboard-A.png"), fullPage: true })

    // 3 — A -> B switch
    await page.goto(`${BASE}/workspaces`, { waitUntil: "domcontentloaded" })
    await enterCard(page, "(B)")
    record("A->B switch persists DB last-used = org B", (await dbOrg("admin@f21.test")) === ID.B, await dbOrg("admin@f21.test"))
    const s1 = await sessionUser(page)
    record("A->B switch updates JWT session org = B", s1?.organizationId === ID.B, JSON.stringify(s1))
    await page.screenshot({ path: path.join(SHOTS, "03-dashboard-B.png"), fullPage: true })

    // 4 — board reflects B as active
    await page.goto(`${BASE}/workspaces`, { waitUntil: "domcontentloaded" })
    const c1 = await cards(page)
    record("board marks B as last-used after switch", !!c1.find((c) => c.active)?.name.includes("(B)"), JSON.stringify(c1.map((c) => [c.name, c.active])))
    record("A card now offers 'Vstopi'", c1.some((c) => c.name.includes("(A)") && c.button === "Vstopi"), JSON.stringify(c1.map((c) => c.button)))
    await page.screenshot({ path: path.join(SHOTS, "04-board-B.png"), fullPage: true })

    // 5 — B -> A switch
    await enterCard(page, "(A)")
    record("B->A switch persists DB last-used = org A", (await dbOrg("admin@f21.test")) === ID.A, await dbOrg("admin@f21.test"))
    const s2 = await sessionUser(page)
    record("B->A switch updates JWT session org = A", s2?.organizationId === ID.A, JSON.stringify(s2))

    // 6 — fresh re-login restores last-used workspace
    await ctx.clearCookies()
    await page.goto(`${BASE}/api/auth/session`, { waitUntil: "domcontentloaded" })
    record("cookies cleared -> anonymous session", (await sessionUser(page)) === null, "cleared")
    await login(page, "admin@f21.test")
    record("re-login lands on /workspaces again", page.url().includes("/workspaces"), page.url())
    const c2 = await cards(page)
    record("re-login restores A as last-used", !!c2.find((c) => c.active)?.name.includes("(A)"), JSON.stringify(c2.map((c) => [c.name, c.active])))
    const s3 = await sessionUser(page)
    record("fresh JWT rebuilt from DB last-used = A", s3?.organizationId === ID.A, JSON.stringify(s3))
    await page.screenshot({ path: path.join(SHOTS, "05-relogin-board-A.png"), fullPage: true })

    // 7 — STAFF with two orgs and different roles
    await ctx.clearCookies()
    await login(page, "staff@f21.test")
    record("STAFF real login lands on /workspaces", page.url().includes("/workspaces"), page.url())
    const cs = await cards(page)
    record("STAFF sees both workspaces", cs.length === 2, JSON.stringify(cs.map((c) => c.name)))
    record("STAFF active card enterable (role-agnostic)", cs.every((c) => c.disabled === false), JSON.stringify(cs.map((c) => c.disabled)))
    await enterCard(page, "(B)", "/staff-portal")
    record("STAFF lands on /staff-portal after switch", page.url().includes("/staff-portal"), page.url())
    record("STAFF A->B switch persists", (await dbOrg("staff@f21.test")) === ID.B, await dbOrg("staff@f21.test"))
    const ss = await sessionUser(page)
    record("STAFF global role stays STAFF, org = B", ss?.role === "STAFF" && ss?.organizationId === ID.B, JSON.stringify(ss))
    await page.screenshot({ path: path.join(SHOTS, "06-staff-dashboard-B.png"), fullPage: true })

    // 8 — CLIENTE purpose: public branch, not admin dashboard
    await ctx.clearCookies()
    await login(page, "cliente@f21.test")
    record("CLIENTE is kept out of admin dashboard", !page.url().includes("/dashboard"), page.url())
    record("CLIENTE reaches /my-account", page.url().includes("/my-account"), page.url())
    await page.screenshot({ path: path.join(SHOTS, "07-cliente.png"), fullPage: true })
  } catch (err) {
    record("FATAL", false, err?.stack || String(err))
    try { await page.screenshot({ path: path.join(SHOTS, "FATAL.png"), fullPage: true }) } catch (_) {}
  } finally {
    await prisma.user.update({ where: { id: "f21-user-admin" }, data: { organizationId: ID.A } }).catch(() => {})
    const summary = { total: results.length, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results }
    fs.writeFileSync(OUT, JSON.stringify(summary, null, 2))
    console.log(`\nSUMMARY ${summary.passed}/${summary.total} passed, ${summary.failed} failed`)
    await prisma.$disconnect()
    await browser.close()
    process.exit(summary.failed ? 1 : 0)
  }
})()
