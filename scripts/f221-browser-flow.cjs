// ============================================================
// F2.2.1 — BROWSER FLOW (Playwright + real NextAuth + markec_f21_test)
//
//   Prereq: dev server on :3001 against markec_f21_test
//     DATABASE_URL=.../markec_f21_test npx next dev -p 3001
//   Run:
//     DATABASE_URL=.../markec_f21_test node scripts/f221-browser-flow.cjs
//
// Proverja F2.2.1 UI proti živemu serverju:
//  1. anonimen /workspaces/manage → /login
//  2. login admin@f21.test → /workspaces/manage (h1 + seznam)
//  3. Ustvari nov prazen workspace prek dialoga
//  4. Povabilni URL: dialog pokaže celoten /invite/<token> + Kopiraj;
//     v seznamu povabil token NI viden (DB hrani hash)
//  5. /invite/<token> stran se odpre in pokaže ime podjetja (veljavno)
//     + neveljaven token → "Povabilo ni več veljavno"
//  6. Arhiviran workspace: opozorilo "samo za branje" + Arhiviraj/Aktiviraj
//  7. Izbriši prazen workspace: dialog zahteva vnos imena; gumb je
//     onemogočen dokler ime ni vtipkano; po brisanju org izgine
//
// Hard guard: DATABASE_URL mora biti markec_f21_test.
// ============================================================

const { chromium } = require("@playwright/test")
const { PrismaClient } = require("@prisma/client")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { createHash } = require("node:crypto")

const BASE = "http://127.0.0.1:3001"
const PW = "F21test!2026"
const ADMIN = "admin@f21.test"
const OUT_DIR = path.join(os.tmpdir(), "markec-f221")
const SHOTS = path.join(OUT_DIR, "shots")
const OUT = path.join(OUT_DIR, "results.json")

const dbUrl = process.env.DATABASE_URL || ""
if (!/^postgresql:\/\/[^@]*@[^/]+\/markec_f21_test(\?|$)/.test(dbUrl)) {
  console.error("REFUSED: DATABASE_URL must point to markec_f21_test")
  process.exit(1)
}
const prisma = new PrismaClient()

const results = []
function record(name, ok, detail) {
  const row = { name, ok: !!ok, detail: String(detail ?? "").slice(0, 300) }
  results.push(row)
  console.log(`${ok ? "PASS" : "FAIL"} | ${name} | ${row.detail}`)
}

async function waitHydrated(page) {
  await page.waitForFunction(
    () => Object.getOwnPropertyNames(document.body).some((k) => k.startsWith("__reactProps$")),
    null,
    { timeout: 120000 }
  )
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" })
  await waitHydrated(page)
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(PW)
  await page.locator('button[type="submit"]').click()
  await page.waitForFunction(() => !location.pathname.startsWith("/login"), null, { timeout: 120000 })
}

;(async () => {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    baseURL: BASE,
    viewport: { width: 1440, height: 900 },
  })
  ctx.setDefaultTimeout(120000)
  ctx.setDefaultNavigationTimeout(120000)
  // Headless brez dovoljenja zavrne navigator.clipboard.writeText —
  // pravi uporabnik v Chrome dobiv clipboard-write na uporabniški gest,
  // zato test preda dovoljenje izrecno (F2.2.1: Kopiraj/Kopirano feedback).
  await ctx.grantPermissions(["clipboard-write"], { origin: BASE })
  const page = await ctx.newPage()
  const suffix = Date.now().toString(36)
  const wsName = `F221 B ${suffix}`
  const wsSlug = `f221b-${suffix}`
  let createdOrgId = null
  let inviteToken = null

  try {
    // 1 — anonimen guard
    await page.goto(`${BASE}/workspaces/manage`, { waitUntil: "domcontentloaded" })
    await page.waitForFunction(() => location.pathname.startsWith("/login"), null, { timeout: 120000 })
    record("anonimen /workspaces/manage → /login", page.url().includes("/login"), page.url())

    // 2 — login → manage page
    await login(page, ADMIN)
    await page.goto(`${BASE}/workspaces/manage`, { waitUntil: "domcontentloaded" })
    await waitHydrated(page)
    await page.waitForSelector("h1", { timeout: 60000 })
    const bodyText = await page.locator("body").innerText()
    record("login → /workspaces/manage h1", bodyText.includes("poslovni"), bodyText.slice(0, 80))
    await page.screenshot({ path: path.join(SHOTS, "01-manage.png"), fullPage: false })

    // 3 — create empty workspace
    const before = await prisma.organization.count()
    await page.getByRole("button", { name: "Novi" }).first().click()
    await page.waitForSelector('[role="dialog"]', { timeout: 30000 })
    await page.locator("#ws-name").fill(wsName)
    await page.locator("#ws-slug").fill(wsSlug)
    // pick vertical (first option) if the select is closed
    const select = page.locator('[role="dialog"] [role="combobox"]').first()
    if (await select.count()) {
      const selectText = await select.innerText().catch(() => "")
      if (/izberi/i.test(selectText)) {
        await select.click()
        await page.locator('[role="option"]').first().click()
      }
    }
    await page
      .locator('[role="dialog"] button[type="submit"]')
      .filter({ hasText: /ustvari/i })
      .click()
    await page.waitForTimeout(3000)
    const after = await prisma.organization.count()
    createdOrgId =
      (await prisma.organization.findFirst({
        where: { slug: wsSlug },
        select: { id: true },
      }))?.id ?? null
    record("create nov workspace (UI → DB)", after === before + 1 && !!createdOrgId, `count ${before}->${after}`)

    // 4 — invitation URL dialog
    if (createdOrgId) {
      // Select the new workspace in the left list
      await page
        .locator('[role="group"][aria-label]', { hasText: wsName })
        .first()
        .click()
      await page.waitForTimeout(1500)
      await page.getByRole("button", { name: /povabi/i }).first().click()
      await page.waitForSelector('[role="dialog"]', { timeout: 30000 })
      const invEmail = `f221-${suffix}@test.dev`
      await page.locator('[role="dialog"] input[type="email"]').fill(invEmail)
      await page.locator('[role="dialog"] button[type="submit"]').click()
      await page.waitForSelector('[role="dialog"] input[readonly]', { timeout: 60000 })
      const linkValue = await page.locator('[role="dialog"] input[readonly]').inputValue()
      inviteToken = linkValue.split("/invite/")[1] ?? null
      record(
        "povabilni URL dialog (celoten /invite/<token>)",
        !!inviteToken && linkValue.startsWith(`${BASE}/invite/`) && !/^[a-f0-9]{64}$/.test(inviteToken),
        linkValue
      )
      await page.screenshot({ path: path.join(SHOTS, "02-invite-link.png") })

      // Copy button
      const copyBtn = page.locator('[role="dialog"] button').filter({ hasText: /kopiraj|kopirano/i }).first()
      await copyBtn.click()
      await page.waitForTimeout(500)
      const copyLabel = await copyBtn.innerText().catch(() => "")
      record("gumb Kopiraj → povratna informacija", /kopirano/i.test(copyLabel), copyLabel.trim())

      // DB stores the SHA-256 hash, not the raw token
      const inv = await prisma.organizationInvitation.findUnique({
        where: { organizationId_email: { organizationId: createdOrgId, email: invEmail } },
      })
      record(
        "DB hrani SHA-256 hash, ne surova tokena",
        !!inv && inv.token === createHash("sha256").update(inviteToken).digest("hex") && inv.token !== inviteToken,
        inv?.status ?? "nobenih"
      )

      // Invitation list must NOT contain the raw token
      await page.locator('[role="dialog"] button').filter({ hasText: /zapri/i }).first().click()
      await page.waitForTimeout(800)
      const listText = await page.locator("body").innerText()
      record("seznam povabil tokena NE vsebuje", !listText.includes(inviteToken), listText.slice(0, 60))
    }

    // 5 — /invite/[token] page
    if (inviteToken) {
      const page2 = await ctx.newPage()
      await page2.goto(`${BASE}/invite/${inviteToken}`, { waitUntil: "domcontentloaded" })
      await page2.waitForTimeout(2500)
      const t = await page2.locator("body").innerText()
      record("/invite/<token> pokaže ime podjetja + vlogo", t.includes("Sprejem") || t.includes("F221"), t.slice(0, 100))
      await page2.screenshot({ path: path.join(SHOTS, "03-invite-page.png") })
      await page2.close()

      const page3 = await ctx.newPage()
      await page3.goto(`${BASE}/invite/neveljaven-token-12345`, { waitUntil: "domcontentloaded" })
      await page3.waitForTimeout(2500)
      const t3 = await page3.locator("body").innerText()
      record("neveljaven token → 'ni več veljavno'", t3.includes("ni več veljavno"), t3.slice(0, 80))
      await page3.close()
    }

    // 6 — archive: read-only notice + button swap
    await page.waitForTimeout(500)
    await page.getByRole("button", { name: /arhiviraj/i }).first().click()
    await page.waitForTimeout(2500)
    const archText = await page.locator("body").innerText()
    record("arhiviran → opozorilo 'samo za branje'", archText.includes("samo za branje"), archText.slice(0, 60))
    const activateBtn = await page.getByRole("button", { name: /aktiviraj/i }).first().count()
    record("arhiviran → gumb Aktiviraj vidno", activateBtn > 0, `btn=${activateBtn}`)
    await page.screenshot({ path: path.join(SHOTS, "04-archived.png") })
    // reactivate
    await page.getByRole("button", { name: /aktiviraj/i }).first().click()
    await page.waitForTimeout(2000)

    // 7 — delete: typed-name confirm
    await page.getByRole("button", { name: /izbriši/i }).first().click()
    await page.waitForSelector('[role="dialog"]', { timeout: 30000 })
    const delDialog = page.locator('[role="dialog"]')
    const delBtn = delDialog.locator("button").filter({ hasText: /trajno izbriši/i })
    const disabledBefore = await delBtn.isDisabled()
    await delDialog.locator("#del-confirm").fill(wsName)
    await page.waitForTimeout(300)
    const disabledAfter = await delBtn.isDisabled()
    record("brisanje: potrditveni gumb onemogočen do vnosa imena", disabledBefore && !disabledAfter, `before=${disabledBefore} after=${disabledAfter}`)
    await page.screenshot({ path: path.join(SHOTS, "05-delete-confirm.png") })
    await delBtn.click()
    await page.waitForTimeout(2500)
    const stillThere = await prisma.organization.findUnique({ where: { id: createdOrgId } })
    record("po brisanju: org + račun admina ostane", stillThere === null, `org=${stillThere ? "STILL" : "gone"}`)
    const adminUser = await prisma.user.findUnique({ where: { email: ADMIN } })
    record("uporabniški račun admina NI izbrisan", !!adminUser, adminUser?.id ?? "noben")
  } catch (err) {
    record("NEPRIČAKOVANA NAPAKA", false, err.message)
    await page.screenshot({ path: path.join(SHOTS, "error.png") }).catch(() => {})
  } finally {
    // cleanup: delete leftovers (invite org, members, invitations)
    if (createdOrgId) {
      await prisma.organizationInvitation.deleteMany({ where: { organizationId: createdOrgId } }).catch(() => {})
      await prisma.organizationMember.deleteMany({ where: { organizationId: createdOrgId } }).catch(() => {})
      await prisma.organization.deleteMany({ where: { id: createdOrgId } }).catch(() => {})
    }
    fs.writeFileSync(OUT, JSON.stringify(results, null, 2))
    await browser.close()
    await prisma.$disconnect()
  }

  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} PASS → ${OUT}`)
  process.exit(failed ? 1 : 0)
})()
