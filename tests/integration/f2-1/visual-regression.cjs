// ============================================================
// F2.1 — VISUAL REGRESSION at 390 / 768 / 1440 px
//
// Same prerequisites as browser-flow.cjs (isolated seeded test DB +
// dev server on F21_BASE_URL). Run:
//   F21_BASE_URL=http://127.0.0.1:3001 \
//   DATABASE_URL="postgresql://.../markec_f21_test?schema=public" \
//     node tests/integration/f2-1/visual-regression.cjs
//
// Checks: horizontal overflow, card geometry, long-name truncation,
// active badge containment, responsive grid, mobile menu switcher,
// real workspace switch from the mobile menu, desktop header link.
// Writes screenshots + JSON to F21_OUT_DIR (default: OS tmpdir).
// ============================================================

const { chromium } = require("@playwright/test")
const { PrismaClient } = require("@prisma/client")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const BASE = process.env.F21_BASE_URL || "http://127.0.0.1:3001"
const PW = process.env.F21_TEST_PASSWORD || "F21test!2026"
const OUT_DIR = process.env.F21_OUT_DIR || path.join(os.tmpdir(), "markec-f21")
const SHOTS = path.join(OUT_DIR, "visual")
const OUT = path.join(OUT_DIR, "visual-results.json")
const WIDTHS = [390, 768, 1440]
const ID = { A: "f21-org-a", B: "f21-org-b" }

const dbUrl = process.env.DATABASE_URL || ""
if (!/^postgresql:\/\/[^@]*@[^/]+\/markec_f21_test(\?|$)/.test(dbUrl)) {
  console.error("REFUSED: DATABASE_URL must point to markec_f21_test")
  process.exit(1)
}
const prisma = new PrismaClient()

const results = []
function rec(name, width, ok, detail) {
  const row = { width, name, ok: !!ok, detail: String(detail ?? "") }
  results.push(row)
  console.log(`${ok ? "PASS" : "FAIL"} | ${width}px | ${name} | ${row.detail}`)
}

async function waitHydrated(page) {
  await page.waitForFunction(
    () => Object.getOwnPropertyNames(document.body).some((k) => k.startsWith("__reactProps$")),
    null,
    { timeout: 180000 }
  )
}
async function layout(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth
    const cards = [...document.querySelectorAll('[role="group"][aria-label]')].map((el) => {
      const r = el.getBoundingClientRect()
      const h = el.querySelector("h2")
      const hr = h?.getBoundingClientRect()
      const badge = el.querySelector('[title^="Prostor, v katerem"]')
      const br = badge?.getBoundingClientRect()
      return {
        name: el.getAttribute("aria-label"),
        left: Math.round(r.left), right: Math.round(r.right),
        headingRight: hr ? Math.round(hr.right) : null,
        headingTruncated: h ? h.scrollWidth > h.clientWidth + 1 : null,
        badgeRight: br ? Math.round(br.right) : null,
        badgeInsideCard: br ? br.right <= r.right + 1 && br.left >= r.left - 1 : null,
        hasBadge: !!br,
        buttonDisabled: el.querySelector("button")?.disabled ?? null,
      }
    })
    const grid = document.querySelector(".grid.w-full")
    const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length : null
    const menuBtn = [...document.querySelectorAll("header button")].find((b) => b.querySelector(".sr-only")?.textContent?.includes("Odpri meni"))
    const menuVisible = menuBtn ? getComputedStyle(menuBtn).display !== "none" && menuBtn.getBoundingClientRect().width > 0 : false
    return {
      vw,
      docScrollWidth: document.documentElement.scrollWidth,
      noHorizontalOverflow: document.documentElement.scrollWidth <= vw + 1,
      cards, cols, menuVisible,
      headerRight: Math.round(document.querySelector("header")?.getBoundingClientRect().right ?? 0),
    }
  })
}
async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" })
  await waitHydrated(page)
  await page.locator("#email").fill("admin@f21.test")
  await page.locator("#password").fill(PW)
  await page.locator('button[type="submit"]').click()
  // App Router soft-navigations don't fire Playwright navigation events,
  // so poll window.location instead of waitForURL.
  await page.waitForFunction(() => !location.pathname.startsWith("/login"), null, { timeout: 180000 })
  await page.locator("body").waitFor({ state: "attached", timeout: 60000 })
}

;(async () => {
  fs.mkdirSync(SHOTS, { recursive: true })
  await prisma.user.update({ where: { id: "f21-user-admin" }, data: { organizationId: ID.A } })
  await prisma.user.update({ where: { id: "f21-user-staff" }, data: { organizationId: ID.A } })

  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 390, height: 844 } })
  ctx.setDefaultTimeout(180000)
  ctx.setDefaultNavigationTimeout(180000)
  const page = await ctx.newPage()
  try {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
      await ctx.clearCookies()

      // login page (anonymous)
      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" })
      const l = await layout(page)
      rec("login: no horizontal overflow", width, l.noHorizontalOverflow, `scrollW=${l.docScrollWidth} vw=${l.vw}`)
      await page.screenshot({ path: `${SHOTS}/${width}-login.png`, fullPage: true })

      // authenticated board
      await login(page)
      await page.goto(`${BASE}/workspaces`, { waitUntil: "domcontentloaded" })
      const w = await layout(page)
      rec("board: no horizontal overflow", width, w.noHorizontalOverflow, `scrollW=${w.docScrollWidth} vw=${w.vw}`)
      rec("board: 2 workspace cards", width, w.cards.length === 2, JSON.stringify(w.cards.map((c) => c.name)))
      rec("board: all cards inside viewport", width, w.cards.every((c) => c.right <= w.vw + 1 && c.left >= -1), JSON.stringify(w.cards.map((c) => [c.left, c.right])))
      rec("board: active badge exists and is inside its card", width, w.cards.some((c) => c.hasBadge) && w.cards.every((c) => c.badgeInsideCard === null || c.badgeInsideCard === true), JSON.stringify(w.cards.map((c) => [c.badgeRight, c.right])))
      rec("board: long name truncated, not expanding card", width, w.cards.some((c) => c.headingTruncated === true) && w.cards.every((c) => c.headingRight === null || c.headingRight <= c.right + 1), JSON.stringify(w.cards.map((c) => [c.headingTruncated, c.headingRight, c.right])))
      rec("board: both cards enterable", width, w.cards.every((c) => c.buttonDisabled === false), JSON.stringify(w.cards.map((c) => c.buttonDisabled)))
      const expectedCols = width === 390 ? 1 : 2
      rec("board: responsive grid columns", width, w.cols === expectedCols, `cols=${w.cols} expected=${expectedCols}`)
      await page.screenshot({ path: `${SHOTS}/${width}-workspaces.png`, fullPage: true })

      // dashboard
      await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" })
      await waitHydrated(page)
      const d = await layout(page)
      rec("dashboard: no horizontal overflow", width, d.noHorizontalOverflow, `scrollW=${d.docScrollWidth} vw=${d.vw}`)
      rec("dashboard: header inside viewport", width, d.headerRight <= d.vw + 1, `headerRight=${d.headerRight}`)
      rec("dashboard: mobile menu visibility matches breakpoint", width, d.menuVisible === (width < 1024), `visible=${d.menuVisible}`)
      await page.screenshot({ path: `${SHOTS}/${width}-dashboard.png`, fullPage: true })

      if (width < 1024) {
        await page.getByRole("button", { name: "Odpri meni" }).click()
        const sheet = page.locator('[role="dialog"]')
        await sheet.waitFor({ state: "visible", timeout: 60000 })
        const trigger = sheet.locator('button[aria-haspopup="listbox"]')
        rec("mobile menu: OrgSwitcher trigger present", width, (await trigger.count()) === 1, `count=${await trigger.count()}`)
        const sheetBox = await sheet.boundingBox()
        const trigBox = await trigger.boundingBox()
        rec("mobile menu: switcher inside sheet + viewport", width, !!trigBox && !!sheetBox && trigBox.x >= 0 && trigBox.x + trigBox.width <= width + 1 && trigBox.x >= sheetBox.x - 1, JSON.stringify({ trigBox, sheetBox }))
        await trigger.click()
        const list = sheet.locator('[role="listbox"][aria-label="Podjetja na računu"]')
        await list.waitFor({ state: "visible", timeout: 60000 })
        const opts = list.locator('[role="option"]')
        rec("mobile menu: both workspaces listed", width, (await opts.count()) === 2, `options=${await opts.count()}`)
        const boxes = await opts.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right) } }))
        rec("mobile menu: options inside viewport", width, boxes.every((b) => b.left >= -1 && b.right <= width + 1), JSON.stringify(boxes))
        await page.screenshot({ path: `${SHOTS}/${width}-mobile-menu-switcher.png` })

        await opts.filter({ hasText: "(B)" }).click()
        // The switch is an async server action. For an ADMIN already on
        // /dashboard the URL does NOT change, so waiting on the pathname
        // resolves instantly and races the DB write (especially on the
        // first compile of the action). Poll the DB until it persists.
        await page.waitForFunction(() => location.pathname.startsWith("/dashboard"), null, { timeout: 180000 })
        const deadline = Date.now() + 60000
        let dbAfter = await prisma.user.findUnique({ where: { email: "admin@f21.test" }, select: { organizationId: true } })
        while (dbAfter?.organizationId !== ID.B && Date.now() < deadline) {
          await page.waitForTimeout(500)
          dbAfter = await prisma.user.findUnique({ where: { email: "admin@f21.test" }, select: { organizationId: true } })
        }
        rec("mobile menu: switch to B persists", width, dbAfter?.organizationId === ID.B, dbAfter?.organizationId ?? "null")
        await prisma.user.update({ where: { id: "f21-user-admin" }, data: { organizationId: ID.A } })
      } else {
        await page.locator("header button.rounded-full").first().click()
        const switchLink = page.getByRole("menuitem", { name: /Zamenjaj poslovni prostor/ })
        const visible = await switchLink.isVisible().catch(() => false)
        rec("desktop header: switch-workspace menu item visible", width, visible, `visible=${visible}`)
        await page.screenshot({ path: `${SHOTS}/${width}-header-menu.png` })
        if (visible) {
          await switchLink.click()
          await page.waitForFunction(() => location.pathname.startsWith("/workspaces"), null, { timeout: 180000 })
          rec("desktop header: link opens /workspaces", width, page.url().includes("/workspaces"), page.url())
        }
      }
    }
  } catch (err) {
    rec("FATAL", 0, false, err?.stack || String(err))
    try { await page.screenshot({ path: `${SHOTS}/FATAL.png`, fullPage: true }) } catch (_) {}
  } finally {
    await prisma.user.update({ where: { id: "f21-user-admin" }, data: { organizationId: ID.A } }).catch(() => {})
    const summary = { total: results.length, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, widths: WIDTHS, results }
    fs.writeFileSync(OUT, JSON.stringify(summary, null, 2))
    console.log(`\nSUMMARY ${summary.passed}/${summary.total} passed, ${summary.failed} failed`)
    await prisma.$disconnect()
    await browser.close()
    process.exit(summary.failed ? 1 : 0)
  }
})()
