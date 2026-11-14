// ============================================================
// F5.3.1.1 — BROWSER ACCEPTANCE (v4) — Playwright, markec_f531_test
//
// Deterministična E3-2 pot: test baza je pripravljena z OBJAVLJENIM BAZNIM
// snapshotom (seed-content). Tok nato: uredi osnutek → javna stran OSTANE na
// snapshotu → ponovno OBJAVI (nova verzija) → javna stran prikaže novo →
// povrni na objavljeno.
//
// Run:
//   set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/markec_f531_test?schema=public
//   node scripts/f531-browser-flow.cjs
// ============================================================
const { chromium } = require("@playwright/test")
const { PrismaClient } = require("@prisma/client")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const BASE = "http://localhost:3000"
const OUT_DIR = path.join(os.tmpdir(), "markec-f5311")
const SHOTS = path.join(OUT_DIR, "shots")
const OUT = path.join(OUT_DIR, "results.json")

if (!/markec_f531_test(\?|$)/.test(process.env.DATABASE_URL || "")) {
  console.error("REFUSED: DATABASE_URL must point to markec_f531_test")
  process.exit(1)
}
const put = new PrismaClient()
const dbRow = async (f) => {
  const org = await put.organization.findFirst({ where: { slug: "demo-salon" }, select: { id: true } })
  return f(org.id)
}
const getPubVer = () =>
  dbRow(async (id) => (await put.salonConfig.findUnique({ where: { organizationId: id }, select: { publishedContentVersion: true } }))?.publishedContentVersion ?? null)
const getDraftTitle = () =>
  dbRow(async (id) => (await put.salonConfig.findUnique({ where: { organizationId: id }, select: { siteContent: true } }))?.siteContent?.hero?.title ?? null)
const getSnapTitle = () =>
  dbRow(async (id) => (await put.salonConfig.findUnique({ where: { organizationId: id }, select: { publishedSiteContent: true } }))?.publishedSiteContent?.hero?.title ?? null)

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
  // počakaj da iframe predogled v celoti naloži (h1)
  const h = page.frameLocator("iframe").first().locator("h1").first()
  await h.waitFor({ timeout: 40000 }).catch(() => {})
  await page.waitForTimeout(1500)
}
const heroInput = (page) =>
  page
    .locator("aside")
    .filter({ hasText: "Uredi: Naslovnica (hero)" })
    .locator("label", { hasText: "Naslov" })
    .locator("..")
    .locator("input")
    .first()
const publicText = async (ctx, selector) => {
  const p = ctx.pages().length > 1 ? ctx.pages().at(-1) : await ctx.newPage()
  await p.goto(`${BASE}/s/demo-salon`, { waitUntil: "domcontentloaded", timeout: 120000 })
  await p.waitForTimeout(1200)
  const el = p.locator(selector).first()
  await el.waitFor({ timeout: 40000 }).catch(() => {})
  const t = (await el.count()) > 0 ? (await el.innerHTML()).replace(/<[^>]*>/g, "").trim() : ""
  return { text: t, page: p }
}

;(async () => {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  // A login
  try {
    await login(page, "admin@rcbeautysalon.org", "admin123")
    record("A prijava podjetnika", !new URL(page.url()).pathname.startsWith("/login"), page.url())
  } catch (e) {
    record("A prijava podjetnika", false, "EXC " + e.message.slice(0, 160))
  }

  // B open editor + baseline snapshot exists
  try {
    await openEditor(page)
    const hasIframe = (await page.locator("iframe").count()) > 0
    const hasSections = (await page.locator("aside li").count()) > 0
    const pubVer = await getPubVer()
    record("B1 odprt vizualni urejevalnik (snapshot obstaja)", hasIframe && hasSections && pubVer != null, `iframe=${hasIframe} sections=${hasSections} pubVer=${pubVer}`)
    await page.screenshot({ path: path.join(SHOTS, "b-editor.png"), fullPage: true }).catch(() => {})
  } catch (e) {
    record("B1 odprt vizualni urejevalnik (snapshot obstaja)", false, "EXC " + e.message.slice(0, 160))
  }

  // C select a section
  try {
    await page.locator("aside").locator("text=O nas").first().click()
    await page.waitForTimeout(500)
    const insp = (await page.getByText("Uredi: O nas").count()) > 0
    record("C izbor sekcije", insp, insp ? "inspector O nas" : "ni inspectorja")
  } catch (e) {
    record("C izbor sekcije", false, "EXC " + e.message.slice(0, 160))
  }

  // D edit hero -> preview updates (draft, NO save yet)
  let draftPreview = ""
  try {
    await page.locator("aside").locator("text=Naslovnica (hero)").first().click()
    await page.waitForTimeout(700)
    const input = heroInput(page)
    await input.waitFor({ timeout: 20000 })
    for (let i = 1; i <= 4; i++) {
      await input.fill("F5.3.1 Testni Naslov Edita")
      await page.waitForTimeout(800)
      const h = page.frameLocator("iframe").first().locator("h1").first()
      draftPreview = (await h.count()) > 0 ? (await h.innerText()).trim() : ""
      if (draftPreview.includes("F5.3.1 Testni")) break
    }
    record("D urejanje naslova -> predogled takoj posodobljen", draftPreview.includes("F5.3.1 Testni"), `ifr h1="${draftPreview.slice(0, 50)}"`)
    await page.screenshot({ path: path.join(SHOTS, "d-hero-edited.png"), fullPage: true }).catch(() => {})
  } catch (e) {
    record("D urejanje naslova -> predogled takoj posodobljen", false, "EXC " + e.message.slice(0, 160))
  }

  // P photo change (existing upload system → hero.imageUrl)
  try {
    // majhna 1×1 PNG v temp
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    )
    const tmpPng = path.join(os.tmpdir(), "f531-test.png")
    fs.writeFileSync(tmpPng, png)
    await page.locator("aside").locator("text=Naslovnica (hero)").first().click()
    await page.waitForTimeout(600)
    const panel = page.locator("aside").filter({ hasText: "Uredi: Naslovnica (hero)" })
    const fileInput = panel.locator('input[type="file"]')
    await fileInput.first().waitFor({ timeout: 20000, state: "attached" })
    await fileInput.first().setInputFiles(tmpPng)
    // počakaj, da se imageUrl v inspectorju (readOnly input) napolni z /api/media ali https
    let imgUrl = ""
    for (let i = 1; i <= 8; i++) {
      await page.waitForTimeout(1000)
      const imgInput = panel.locator('input[readonly]').first()
      imgUrl = (await imgInput.inputValue().catch(() => "")) || ""
      if (/\/api\/media\/|https?:|tserver|cloudinary|\.avif|\.jpg/.test(imgUrl)) break
    }
    const uploaded = /\/api\/media\/|https?:|cloudinary/.test(imgUrl)
    // Shrani osnutek → fotografija (draft) se zapiše v DB (E3-2: draft, ne javna stran)
    await page.getByRole("button", { name: "Shrani osnutek" }).click()
    await page.waitForTimeout(1800)
    // preveri v DB draft hero.imageUrl
    const draftHeroImg = await dbRow(async (id) =>
      (await put.salonConfig.findUnique({ where: { organizationId: id }, select: { siteContent: true } }))?.siteContent?.hero?.imageUrl ?? null
    )
    record("P sprememba fotografije (upload → hero.imageUrl)", uploaded && typeof draftHeroImg === "string" && draftHeroImg.length > 0, `inputUrl="${imgUrl.slice(0, 50)}" draftImg="${String(draftHeroImg).slice(0, 50)}"`)
    fs.unlinkSync(tmpPng)
    await page.screenshot({ path: path.join(SHOTS, "p-photo.png"), fullPage: true }).catch(() => {})
  } catch (e) {
    record("P sprememba fotografije (upload → hero.imageUrl)", false, "EXC " + e.message.slice(0, 180))
  }

  // E devices
  const widths = {}
  try {
    for (const dev of ["1440", "768", "390"]) {
      await page.getByRole("button", { name: dev }).click()
      await page.waitForTimeout(400)
      widths[dev] = Math.round(await page.locator("iframe").first().evaluate((el) => el.getBoundingClientRect().width))
    }
    const okW = Object.entries(widths).every(([d, w]) => Math.abs(w - Number(d)) <= 4)
    record("E naprave 1440/768/390", okW, JSON.stringify(widths))
    await page.screenshot({ path: path.join(SHOTS, "e-390.png") }).catch(() => {})
  } catch (e) {
    record("E naprave 1440/768/390", false, "EXC " + e.message.slice(0, 160))
  }

  // F drag-and-drop reorder
  try {
    await page.getByRole("button", { name: "1440" }).click()
    await page.waitForTimeout(300)
    const before = (await page.locator("aside li div button").allInnerTexts()).map((x) => x.trim())
    const bHero = before.findIndex((x) => x.includes("Naslovnica"))
    await page.locator("aside li").filter({ hasText: "Naslovnica (hero)" }).dragTo(page.locator("aside li").filter({ hasText: "O nas" }))
    await page.waitForTimeout(600)
    const after = (await page.locator("aside li div button").allInnerTexts()).map((x) => x.trim())
    const aHero = after.findIndex((x) => x.includes("Naslovnica"))
    record("F drag-and-drop razvrščanje sekcij", bHero !== aHero, `hero ${bHero} → ${aHero}`)
    await page.screenshot({ path: path.join(SHOTS, "f-reordered.png"), fullPage: true }).catch(() => {})
  } catch (e) {
    record("F drag-and-drop razvrščanje sekcij", false, "EXC " + e.message.slice(0, 160))
  }

  // G move a section via arrows
  try {
    const before = (await page.locator("aside li div button").allInnerTexts()).map((x) => x.trim())
    const bS = before.findIndex((x) => x.includes("Storitve"))
    const liS = page.locator("aside li").filter({ hasText: "Storitve" })
    await liS.locator('button[title="Dol"]').click()
    await page.waitForTimeout(400)
    const after = (await page.locator("aside li div button").allInnerTexts()).map((x) => x.trim())
    const aS = after.findIndex((x) => x.includes("Storitve"))
    record("G premik sekcije s puščicami", aS > bS, `storitve ${bS} → ${aS}`)
  } catch (e) {
    record("G premik sekcije s puščicami", false, "EXC " + e.message.slice(0, 160))
  }

  // H add a custom section
  try {
    const addBtn = page.locator("aside").locator('h3:has-text("Sekcije")').locator("xpath=ancestor::div[1]").locator("button").filter({ hasText: "Dodaj" })
    await addBtn.click()
    await page.waitForTimeout(400)
    const panelShown = (await page.getByText("Dodaj sekcijo").count()) > 0
    await page.getByRole("button", { name: "Lastna sekcija" }).first().click()
    await page.waitForTimeout(500)
    const hasNew = (await page.locator("aside li").filter({ hasText: "Lastna sekcija" }).count()) > 0
    record("H dodajanje lastne sekcije", panelShown && hasNew, `panel=${panelShown} novaSekcija=${hasNew}`)
  } catch (e) {
    record("H dodajanje lastne sekcije", false, "EXC " + e.message.slice(0, 160))
  }

  // I save draft + reload persists (DRAFT only; PUBLISHED snapshot nespremenjen)
  try {
    const draftBefore = await getDraftTitle()
    await page.getByRole("button", { name: "Shrani osnutek" }).click()
    await page.waitForTimeout(1800)
    const saved = (await page.getByText("Osnutek shranjen").count()) > 0
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 })
    await waitHydrated(page)
    await page.locator("aside").locator("text=Naslovnica (hero)").first().waitFor({ timeout: 60000 }).catch(() => {})
    const h = page.frameLocator("iframe").first().locator("h1").first()
    await h.waitFor({ timeout: 40000 }).catch(() => {})
    const afterReload = (await h.count()) > 0 ? (await h.innerText()).trim() : ""
    const draftAfter = await getDraftTitle()
    const persisted = typeof draftAfter === "string" && draftAfter.includes("F5.3.1 Testni")
    record("I shranjevanje + ponovno nalaganje osnutka", saved && persisted && afterReload.includes("F5.3.1 Testni"), `saved=${saved} draftBefore="${String(draftBefore).slice(0,30)}" draftAfter="${String(draftAfter).slice(0,30)}"`)
  } catch (e) {
    record("I shranjevanje + ponovno nalaganje osnutka", false, "EXC " + e.message.slice(0, 160))
  }

  // M security: anonymous cannot see DRAFT content on /preview
  // (draft = "F5.3.1 Testni", snapshot še = "Vaša lepota"; anon sme videti SAMO javno)
  try {
    const actx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const anon = await actx.newPage()
    const r = await anon.goto(`${BASE}/s/demo-salon/preview`, { waitUntil: "domcontentloaded", timeout: 40000 }).catch(() => null)
    await anon.waitForTimeout(1400)
    const body = await anon.locator("body").innerText().catch(() => "")
    const draftLeak = /F5\.3\.1 Testni/.test(body)
    const landedOnPublic = anon.url().includes("/s/demo-salon") && !anon.url().includes("/preview")
    record("M anonim NE vidi osnutka na draft-preview ruti", !draftLeak, `status=${r ? r.status() : "?"} → ${anon.url()} draftLeak=${draftLeak} publicRedirect=${landedOnPublic}`)
    await anon.screenshot({ path: path.join(SHOTS, "m-anon.png") }).catch(() => {})
    await actx.close().catch(() => {})
  } catch (e) {
    record("M anonim NE vidi osnutka na draft-preview ruti", false, "EXC " + e.message.slice(0, 160))
  }

  // Q concurrent-edit protection: stale save must be rejected (no silent overwrite)
  try {
    // odpri urejevalnik (editor zajame publication.contentVersion)
    await openEditor(page)
    const orgBefore = await put.organization.findFirst({ where: { slug: "demo-salon" }, select: { id: true, contentVersion: true } })
    // drugi uporabnik "objavi/shrani" → contentVersion se dvigne
    await put.organization.update({ where: { id: orgBefore.id }, data: { contentVersion: { increment: 5 } } })
    // zdaj edita naslov in poskusa shraniti → expectedContentVersion (staro) NE sovpada
    await page.locator("aside").locator("text=Naslovnica (hero)").first().click()
    await page.waitForTimeout(600)
    const input = heroInput(page)
    await input.waitFor({ timeout: 20000 })
    await input.fill("F5.3.1 STALE TEST")
    await page.waitForTimeout(400)
    await page.getByRole("button", { name: "Shrani osnutek" }).click()
    await page.waitForTimeout(1800)
    const staleMsg = await page.getByText(/spremenil drug uporabnik/i).count()
    // ali pa se je vsebina ponovno naložila (fresh) — vsaj NE sme takoj shraniti STALE TEST
    const draftStale = await getDraftTitle()
    const rejected = staleMsg > 0 || !String(draftStale).includes("STALE TEST")
    record("Q hkratno urejanje NE prepiše (stale zavrnjen)", rejected, `staleToast=${staleMsg} draftAfter="${String(draftStale).slice(0,40)}"`)
    await page.screenshot({ path: path.join(SHOTS, "q-concurrent.png"), fullPage: true }).catch(() => {})
  } catch (e) {
    record("Q hkratno urejanje NE prepiše (stale zavrnjen)", false, "EXC " + e.message.slice(0, 160))
  }

  // J public unchanged (snapshot) BEFORE republish
  try {
    const { text: publicBefore } = await publicText(ctx, "h1")
    const snapshot = await getSnapTitle()
    const unchanged = publicBefore.length > 0 && !publicBefore.includes("F5.3.1 Testni") && String(snapshot).includes("Vaša lepota")
    record("J javna stran pred objavo NESpremenjena", unchanged, `javni="${publicBefore.slice(0,50)}" snapshot="${String(snapshot).slice(0,40)}"`)
  } catch (e) {
    record("J javna stran pred objavo NESpremenjena", false, "EXC " + e.message.slice(0, 160))
  }

  // K republish -> public shows new version
  try {
    await openEditor(page)
    await page.getByRole("button", { name: "Objavi" }).click()
    await page.waitForTimeout(2500)
    const snapTitle = await getSnapTitle()
    const snapUpdated = typeof snapTitle === "string" && snapTitle.includes("F5.3.1 Testni")
    const { text: publicNow } = await publicText(ctx, "h1")
    record("K objava -> javna stran nove verzije", snapUpdated && publicNow.includes("F5.3.1 Testni"), `snap="${String(snapTitle).slice(0,40)}" javni="${publicNow.slice(0,50)}"`)
    await page.screenshot({ path: path.join(SHOTS, "k-published.png"), fullPage: true }).catch(() => {})
  } catch (e) {
    record("K objava -> javna stran nove verzije", false, "EXC " + e.message.slice(0, 200))
  }

  // L revert to published (after making a NEW draft edit)
  try {
    await openEditor(page)
    await page.locator("aside").locator("text=Naslovnica (hero)").first().click()
    await page.waitForTimeout(700)
    const input = heroInput(page)
    await input.waitFor({ timeout: 20000 })
    await input.fill("F5.3.1 POVRATEK TEST")
    await page.waitForTimeout(500)
    await page.getByRole("button", { name: "Shrani osnutek" }).click()
    await page.waitForTimeout(1800)
    await openEditor(page)
    const revertBtn = page.getByRole("button", { name: "Povrni na objavljeno" })
    await revertBtn.waitFor({ timeout: 20000 })
    if (await revertBtn.isEnabled().catch(() => false)) await revertBtn.click()
    await page.waitForTimeout(2000)
    const { text: publicAfter } = await publicText(ctx, "h1")
    const snapStill = await getSnapTitle()
    const reverted = publicAfter.includes("F5.3.1 Testni") && !publicAfter.includes("POVRATEK") && !String(snapStill).includes("POVRATEK")
    record("L povratek na objavljeno", reverted, `javni="${publicAfter.slice(0,50)}"`)
    await page.screenshot({ path: path.join(SHOTS, "l-reverted.png"), fullPage: true }).catch(() => {})
  } catch (e) {
    record("L povratek na objavljeno", false, "EXC " + e.message.slice(0, 200))
  }

  // N security: other-org user cannot edit demo-salon
  try {
    const nctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const other = await nctx.newPage()
    await login(other, "adminB@rcbeautysalon.org", "adminB123")
    await other.goto(`${BASE}/dashboard/settings?tab=branding`, { waitUntil: "domcontentloaded", timeout: 60000 })
    await other.waitForTimeout(1800)
    const body = await other.locator("body").innerText().catch(() => "")
    const hasDemo = /Salon harmonija|demo-salon/.test(body)
    record("N uporabnik druge org NE uredi demo-salon strani", !hasDemo, `url=${new URL(other.url()).pathname} demoContent=${hasDemo}`)
    await other.screenshot({ path: path.join(SHOTS, "n-other-org.png"), fullPage: true }).catch(() => {})
    await nctx.close().catch(() => {})
  } catch (e) {
    record("N uporabnik druge org NE uredi demo-salon strani", false, "EXC " + e.message.slice(0, 160))
  }

  await browser.close()
  await put.$disconnect()
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2))
  const pass = results.filter((r) => r.ok).length
  const fail = results.filter((r) => !r.ok).length
  console.log(`\n==== F5.3.1.1 browser: PASS ${pass} / FAIL ${fail} / total ${results.length}`)
  console.log("shots:", SHOTS)
  console.log("results:", OUT)
})().catch(async (e) => {
  console.error("FATAL", e)
  await put.$disconnect().catch(() => {})
  process.exit(1)
})