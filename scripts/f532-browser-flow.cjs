// ============================================================
// F5.3.2 — BROWSER ACCEPTANCE (Playwright, markec_f531_test)
// Oblikovne predloge + barve/pisave + navigacija v vizualnem urejevalniku.
//
// Run:
//   set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/markec_f531_test?schema=public
//   node scripts/f532-browser-flow.cjs
// ============================================================
const { chromium } = require("@playwright/test")
const { PrismaClient } = require("@prisma/client")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const BASE = "http://localhost:3000"
const SHOTS = path.join(os.tmpdir(), "markec-f532", "shots")
const OUT = path.join(os.tmpdir(), "markec-f532", "results.json")

if (!/markec_f531_test(\?|$)/.test(process.env.DATABASE_URL || "")) {
  console.error("REFUSED: DATABASE_URL must point to markec_f531_test")
  process.exit(1)
}
const put = new PrismaClient()
const results = []
function record(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: String(detail ?? "").slice(0, 400) })
  console.log(`${ok ? "PASS" : "FAIL"} | ${name} | ${detail}`)
}
async function waitHydrated(page) {
  await page.waitForFunction(
    () => Object.getOwnPropertyNames(document.body).some((k) => k.startsWith("__reactProps$")),
    null,
    { timeout: 60000 }
  )
}
async function login(page, email, pw) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" })
  await waitHydrated(page)
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(pw)
  await page.locator('button[type="submit"]').click()
  await page.waitForFunction(() => !location.pathname.startsWith("/login"), null, { timeout: 60000 })
  await waitHydrated(page)
}
async function openEditor(page) {
  await page.goto(`${BASE}/dashboard/settings?tab=branding`, { waitUntil: "domcontentloaded", timeout: 120000 })
  await waitHydrated(page)
  await page.locator("aside").locator("text=Naslovnica (hero)").first().waitFor({ timeout: 60000 }).catch(() => {})
  await page.locator("iframe").first().waitFor({ timeout: 60000 }).catch(() => {})
}
let errors = []
;(async () => {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await ctx.newPage()
  page.on("pageerror", (e) => { if (!/ResizeObserver/i.test(e.message)) errors.push(e.message) })
  page.on("console", (m) => {
    const t = m.text()
    if (m.type() === "error" && !/ResizeObserver|favicon|upgrade-insecure-requests|CSP|hydrat|didn't match|radix-|ERR_NETWORK_CHANGED|Failed to fetch|autherror|getSession|ClientFetchError/i.test(t)) errors.push(t)
  })

  // A login
  try {
    await login(page, "admin@rcbeautysalon.org", "admin123")
    record("A prijava podjetnika", !new URL(page.url()).pathname.startsWith("/login"), page.url())
  } catch (e) {
    record("A prijava podjetnika", false, "EXC " + e.message.slice(0, 160))
  }

  // B open editor + mode tabs present
  try {
    await openEditor(page)
    const tabsOk =
      (await page.getByRole("button", { name: "Barve in pisave" }).count()) > 0 &&
      (await page.getByRole("button", { name: "Navigacija" }).count()) > 0 &&
      (await page.getByRole("button", { name: "Predloge" }).count()) > 0
    record("B urejevalnik + zavihki (Barve/Navigacija/Predloge)", tabsOk, `tabs=${tabsOk}`)
    await page.screenshot({ path: path.join(SHOTS, "b-tabs.png"), fullPage: true }).catch(() => {})
  } catch (e) {
    record("B urejevalnik + zavihki", false, "EXC " + e.message.slice(0, 160))
  }

  // C Templates: open panel + apply a template -> content preserved
  let draftTitleBefore = ""
  let draftTitleAfter = ""
  try {
    const org = await put.organization.findFirst({ where: { slug: "demo-salon" }, select: { id: true } })
    const cfg = await put.salonConfig.findUnique({ where: { organizationId: org.id }, select: { siteContent: true } })
    draftTitleBefore = cfg?.siteContent?.hero?.title || ""
    await page.getByRole("button", { name: "Predloge" }).click()
    await page.waitForTimeout(600)
    const hasCards = (await page.getByText("Oblikovne predloge").count()) > 0
    // uporabi "Sodobna odločna" predlogo (ni privzeta → gumb Uporabi omogočen)
    const applyBtn = page.getByRole("button", { name: "Uporabi", exact: true }).first()
    await applyBtn.click()
    await page.waitForTimeout(1200)
    // poll DB until _templateId appears (server action + revalidate)
    let templateId = null
    for (let i = 0; i < 8; i++) {
      const org2 = await put.organization.findFirst({ where: { slug: "demo-salon" }, select: { id: true } })
      const cfg2 = await put.salonConfig.findUnique({ where: { organizationId: org2.id }, select: { siteContent: true } })
      templateId = cfg2?.siteContent?._templateId ?? null
      if (templateId) break
      await new Promise((r) => setTimeout(r, 800))
    }
    const cfgFinal = await put.salonConfig.findUnique({
      where: { organizationId: (await put.organization.findFirst({ where: { slug: "demo-salon" }, select: { id: true } })).id },
      select: { siteContent: true },
    })
    draftTitleAfter = cfgFinal?.siteContent?.hero?.title || ""
    const preserved = draftTitleBefore === draftTitleAfter && !!templateId
    record("C predloga uporabljena, vsebina ohranjena", hasCards && preserved && !!templateId, `template="${templateId}" titleBefore="${draftTitleBefore.slice(0,30)}" titleAfter="${draftTitleAfter.slice(0,30)}"`)
    await page.screenshot({ path: path.join(SHOTS, "c-template.png"), fullPage: true }).catch(() => {})
  } catch (e) {
    record("C predloga uporabljena, vsebina ohranjena", false, "EXC " + e.message.slice(0, 180))
  }

  // D Theme panel: change a color + save (verify via DB theme field)
  try {
    await page.getByRole("button", { name: "Barve in pisave" }).click()
    await page.waitForTimeout(700)
    const hasPanel = (await page.getByText("Barve in pisave").count()) > 1
    // nastavi glavno barvo (prvi color input) na berljivo modro
    const colorInput = page.locator('input[type="color"]').first()
    await colorInput.waitFor({ timeout: 20000, state: "attached" })
    await colorInput.fill("#0066CC")
    await page.waitForTimeout(300)
    await page.getByRole("button", { name: "Shrani barve in pisave" }).click()
    await page.waitForTimeout(1800)
    const org = await put.organization.findFirst({ where: { slug: "demo-salon" }, select: { id: true } })
    const cfg = await put.salonConfig.findUnique({ where: { organizationId: org.id }, select: { theme: true } })
    const theme = cfg?.theme
    const savedTheme = !!theme && Object.keys(theme.colors || {}).length > 0
    record("D barve shranjene (draft)", hasPanel && savedTheme, `panel=${hasPanel} themeKeys=${theme && Object.keys(theme.colors || {}).length}`)
    await page.screenshot({ path: path.join(SHOTS, "d-theme.png"), fullPage: true }).catch(() => {})
  } catch (e) {
    record("D barve shranjene (draft)", false, "EXC " + e.message.slice(0, 180))
  }

  // E contrast: bad combination rejected (updateTheme refuses)
  try {
    await page.getByRole("button", { name: "Barve in pisave" }).first().click()
    await page.waitForTimeout(600)
    // Nastavi Besedilo gumba in Ozadje gumba na belo (neberljivo).
    const labelText = (txt) => page.locator("label").filter({ hasText: txt }).first().locator("..").locator('input[type="color"]')
    const btnText = labelText("Besedilo gumba")
    const btnBg = labelText("Ozadje gumba")
    await btnText.waitFor({ timeout: 20000, state: "attached" })
    await btnText.fill("#FFFFFF")
    await btnBg.fill("#FFFFFF")
    await page.waitForTimeout(300)
    await page.getByRole("button", { name: "Shrani barve in pisave" }).click()
    await page.waitForTimeout(1800)
    const errorShown = (await page.getByText(/ni berljivo|neberljiv|Preverite barve/).count()) > 0
    // tema v DB ne sme imeti obeh belih (zavrnjeno)
    const org = await put.organization.findFirst({ where: { slug: "demo-salon" }, select: { id: true } })
    const cfg = await put.salonConfig.findUnique({ where: { organizationId: org.id }, select: { theme: true } })
    const th = cfg?.theme
    const notSavedBothWhite = !(th?.colors?.buttonText === "#FFFFFF" && th?.colors?.buttonBackground === "#FFFFFF")
    record("E kontrast (neberljiva tema) zavrnjen", errorShown && notSavedBothWhite, `errorShown=${errorShown} dbSaved=${!notSavedBothWhite}`)
    await page.screenshot({ path: path.join(SHOTS, "e-contrast.png"), fullPage: true }).catch(() => {})
  } catch (e) {
    record("E kontrast zavrnjen", false, "EXC " + e.message.slice(0, 180))
  }

  // F Navigation: add a nav item -> save -> public navbar shows it
  try {
    await page.getByRole("button", { name: "Navigacija" }).click()
    await page.waitForTimeout(700)
    await page.getByRole("button", { name: "Dodaj povezavo" }).click()
    await page.waitForTimeout(500)
    // izberi "Storitve (sekcija)" (že privzeto) in klikni "Dodaj" v panelu menija
    const navPane = page.locator("aside").filter({ hasText: "Glavni meni" })
    const addBtn = navPane.getByRole("button", { name: "Dodaj", exact: true })
    await addBtn.click()
    await page.waitForTimeout(400)
    // shrani osnutek (edit nav je v content state)
    await page.getByRole("button", { name: "Shrani osnutek" }).click()
    await page.waitForTimeout(1800)
    const org = await put.organization.findFirst({ where: { slug: "demo-salon" }, select: { id: true } })
    const cfg = await put.salonConfig.findUnique({ where: { organizationId: org.id }, select: { siteContent: true } })
    const nav = cfg?.siteContent?.nav || []
    // poll dokler se nav ne zapiše (save + revalidate timing)
    let navLen = Array.isArray(nav) ? nav.length : 0
    for (let i = 0; i < 6 && navLen === 0; i++) {
      await new Promise((r) => setTimeout(r, 800))
      const c = await put.salonConfig.findUnique({ where: { organizationId: org.id }, select: { siteContent: true } })
      navLen = Array.isArray(c?.siteContent?.nav) ? c.siteContent.nav.length : 0
    }
    record("F navigacija dodana v osnutek", navLen > 0, `navRows=${navLen}`)
    await page.screenshot({ path: path.join(SHOTS, "f-nav.png"), fullPage: true }).catch(() => {})

    // K: objavi → javna stran prikaže lastnikovo navigacijo ("Storitve" link)
    await page.getByRole("button", { name: "Objavi" }).click()
    await page.waitForTimeout(2200)
    await page.goto(`${BASE}/s/demo-salon`, { waitUntil: "domcontentloaded", timeout: 120000 })
    await page.waitForTimeout(1200)
    const headerText = await page.locator("header").innerText().catch(() => "")
    // Lastnikova nav se upodobi z lastniškimi oznakami ("O nas (sekcija)"),
    // ne s privzeto platformsko "O nas" → dokaz, da se owner nav prikaže.
    const ownerNavShown = headerText.includes("(sekcija)") || headerText.includes("Storitve")
    record("K objava → javna stran prikaže lastnikovo navigacijo", ownerNavShown, ownerNavShown ? `header: ${headerText.split("\\n").slice(0,4).join(" | ")}` : headerText.slice(0, 60))
    await page.screenshot({ path: path.join(SHOTS, "k-public-nav.png"), fullPage: true }).catch(() => {})
  } catch (e) {
    record("F navigacija dodana v osnutek", false, "EXC " + e.message.slice(0, 180))
  }

  // G devices 1440/768/390 (iframe)
  const widths = {}
  try {
    // K je navigiral na javno stran — odpri urejevalnik nazaj
    await openEditor(page)
    await page.getByRole("button", { name: "Sekcije" }).first().click()
    await page.waitForTimeout(400)
    for (const dev of ["1440", "768", "390"]) {
      await page.getByRole("button", { name: dev }).click()
      await page.waitForTimeout(350)
      widths[dev] = Math.round(await page.locator("iframe").first().evaluate((el) => el.getBoundingClientRect().width))
    }
    const okW = Object.entries(widths).every(([d, w]) => Math.abs(w - Number(d)) <= 4)
    record("G naprave 1440/768/390", okW, JSON.stringify(widths))
    await page.screenshot({ path: path.join(SHOTS, "g-390.png") }).catch(() => {})
  } catch (e) {
    record("G naprave 1440/768/390", false, "EXC " + e.message.slice(0, 160))
  }

  record("H brez konzolnih napak (nov panel)", errors.length === 0, errors.length ? errors.slice(0, 3).join(" | ") : "clean")

  await browser.close()
  await put.$disconnect()
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2))
  const pass = results.filter((r) => r.ok).length
  const fail = results.filter((r) => !r.ok).length
  console.log(`\n==== F5.3.2 browser: PASS ${pass} / FAIL ${fail} / total ${results.length}`)
  console.log("shots:", SHOTS)
})().catch(async (e) => {
  console.error("FATAL", e)
  await put.$disconnect().catch(() => {})
  process.exit(1)
})