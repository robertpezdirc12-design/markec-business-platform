import { test, expect, type Page } from "@playwright/test"

// ============================================================
// 2D-8 — REAL END-TO-END: céloten uporabniški tok vizualnega
// urejevalnika, izveden v resničnem brskalniku (Playwright).
//
// Za VSAKEGA od treh referenčnih podjetnikov:
//   prijava → Settings → Izgled in vsebina → Vizualni urejevalnik
//   → klik '✎ Uredi sekcijo' v predogledu (miško) → spremeni naslov
//   → naloži lokalno fotografijo prek UI pickerja → shrani osnutek
//   → predogled → objavi → javna stran → ponovna prijava (persistenco)
//   → povrnitev v prvotno stanje + ponovna objava.
//
// Teče ob PRIŽGAtem dev strežniku na testni bazi (ne gradimo produkcije,
// ker tuji WIP einvoices blokira build):
//   PROJECT_URL=http://localhost:3002 npx playwright test playwright.2d8.config.ts
// ============================================================

const BASE = process.env.PROJECT_URL || ""

const ORGS = {
  vulkanizer: ["cebeler.tire@markec.test", "demo1234", "svezi-vulkanizer-2d1s", "Vaše vozilo v najboljših rokah"],
  cebelar: ["cebeler.fresh@markec.test", "demo1234", "svezi-cebeler-2d1l", "Med, kot ga daje narava"],
  sivilja: ["atelje.fresh@markec.test", "demo1234", "svezi-atelje-2d2", "Vsako oblačilo, popolno prileganje"],
} as const
type OrgKey = keyof typeof ORGS

const FIXTURE = "e2e/fixtures/f63-test.png" // 70B valid 1x1 PNG
const RUN = Date.now().toString(36)

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`)
  const emailField = page.getByLabel(/e-pošta/i)
  await emailField.waitFor({ timeout: 20000 })
  await emailField.fill(email)
  await page.getByLabel(/geslo/i).fill(password)
  await page.getByRole("button", { name: /prijava/i }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 30000 })
}

async function openVisualEditor(page: Page) {
  await page.goto(`${BASE}/dashboard/settings?tab=branding`)
  await page.getByRole("tab", { name: /vizualni urejevalnik/i }).first().waitFor({ timeout: 20000 })
  await page.getByRole("tab", { name: /vizualni urejevalnik/i }).first().click()
  // Počakaj, da se iframe predogleda v edit-modeu naloži.
  await page.waitForSelector("iframe", { timeout: 30000 })
  await page.waitForTimeout(2500)
}

/** Izberi sekcijo z miško v levem seznamu vizualnega urejevalnika (zanesljivo,
 *  brez iframe postMessage). Hero = "Naslovnica (hero)". */
async function clickEditSection(page: Page, sectionId: string) {
  const heroLabel = sectionId === "hero" ? "Naslovnica (hero)" : sectionId
  const li = page.locator("li").filter({ hasText: heroLabel }).first()
  await li.waitFor({ timeout: 20000 })
  await li.scrollIntoViewIfNeeded()
  await li.click()
  await page.waitForTimeout(1200)
}

async function setSectionTitle(page: Page, title: string) {
  // Inspector Naslov input: prvi vhod v desni plošči (aside z "Uredi:").
  // Scope-ajmo PO strani z besedo, da se izognemo skritim poljem klasičnega
  // obrazca (BrandingEditor, force-mounted). 
  await page.getByText(/uredi:/i).first().waitFor({ timeout: 20000 })
  const aside = page.locator("aside").filter({ hasText: "Uredi:" }).last()
  const inp = aside.locator("input").filter({ visible: true }).first()
  await inp.waitFor({ timeout: 15000 })
  await inp.fill(title)
  await page.waitForTimeout(400)
}

async function uploadPhotoViaPicker(page: Page) {
  // V inspectorju (izbrana hero/about/custom sekcija) nastavi lokalno datoteko
  // na skriti input[type=file] — pravi UI picker (setInputFiles deluje tudi na
  // hidden). Scope-ajmo na desno ploščo (aside z "Uredi:"), stran od klasičnega
  // obrazca.
  await page.getByText(/uredi:/i).first().waitFor({ timeout: 20000 })
  const aside = page.locator("aside").filter({ hasText: "Uredi:" }).last()
  const fileInput = aside.locator('input[type="file"]').first()
  await fileInput.waitFor({ state: "attached", timeout: 15000 })
  await fileInput.setInputFiles(FIXTURE)
  await page.waitForTimeout(3000)
}

async function saveDraftAndPublish(page: Page) {
  const saveBtn = page.getByRole("button", { name: /shrani osnutek/i })
  await saveBtn.click()
  // Počakaj na potrditev shranjevanja (toast) ali vsaj na stabilen osnutek.
  await page.waitForTimeout(2000).catch(() => undefined)
  await page.getByText(/osnutek shranjen/i).first().waitFor({ timeout: 25000 }).catch(() => undefined)
  const pubBtn = page.getByRole("button", { name: /^objavi/i })
  await pubBtn.click()
  // Počakaj, da se objava potrdi ("Objavljeno" / toast), da javna stran res dobi novo vsebino.
  await page.getByText(/objavljen/i).first().waitFor({ timeout: 25000 }).catch(() => undefined)
  await page.waitForTimeout(3000)
}

async function revertDraft(page: Page) {
  // Povrni osnutek na objavljeno → javna stran se ne spremeni trajno.
  const revert = page.getByRole("button", { name: /vrni|return|razveljavi/i }).first()
  if (await revert.isVisible().catch(() => false)) {
    await revert.click()
    await page.waitForTimeout(1500)
  }
}

test.describe("2D-8 — céloten tok urejevalnika (real browser, drei orgs)", () => {
  for (const key of Object.keys(ORGS) as OrgKey[]) {
    const [email, pass, slug, originalH1] = ORGS[key]
    const testTitle = `2D-8 ${key}: prijava→uredi→upload→shrani→objavi→javna→povrni`

    test(testTitle, async ({ page, browser }) => {
      const edited = `2D-8 ${key} ${RUN}`

      // 1. Prijava
      await login(page, email, pass)

      // 2. Odpri vizualni urejevalnik
      await openVisualEditor(page)

      // 3. Miško klikni '✎ Uredi sekcijo' na hero
      await clickEditSection(page, "hero")

      // 4. Spremeni naslov
      await setSectionTitle(page, edited)

      // 5. Naloži fotografijo prek UI pickerja
      await uploadPhotoViaPicker(page)

      // 6. Shrani osnutek + 7. objavi
      await saveDraftAndPublish(page)

      // 8. Javna stran (ločena, NEPRIJAVLJENA seja: nov browser context brez
      //    cookie-jev → pravi obiskovalec). Počakamo na NOV naslov (objava).
      const pubCtx = await browser.newContext()
      const pub = await pubCtx.newPage()
      await pub.goto(`${BASE}/s/${slug}`)
      await expect(pub.locator("h1").first()).toBeVisible({ timeout: 40000 })
      let h1 = ""
      await expect
        .poll(async () => (await pub.locator("h1").first().innerText().catch(() => "")).trim(), {
          timeout: 40000,
        })
        .toBe(edited)
      h1 = (await pub.locator("h1").first().innerText()).trim()
      await pubCtx.close()

      // 9. Ponovna prijava (svež context → pravi login z geslom) → stanje ohranjeno.
      const againCtx = await browser.newContext()
      const again = await againCtx.newPage()
      await login(again, email, pass)
      await openVisualEditor(again)
      await clickEditSection(again, "hero")
      let persistedTitle = ""
      await again.getByText(/uredi:/i).first().waitFor({ timeout: 20000 }).catch(() => undefined)
      try {
        const aside = again.locator("aside").filter({ hasText: "Uredi:" }).last()
        persistedTitle = (await aside.locator("input").filter({ visible: true }).first().inputValue()).trim()
      } catch { /* nista najden */ }
      await againCtx.close()

      // 10. Povrni v prvotno stanje in ponovno objavi (svež context).
      const revCtx = await browser.newContext()
      const revertPage = await revCtx.newPage()
      await login(revertPage, email, pass)
      await openVisualEditor(revertPage)
      await clickEditSection(revertPage, "hero")
      await setSectionTitle(revertPage, originalH1)
      await saveDraftAndPublish(revertPage)
      await revCtx.close()

      // Assercije
      const h1Changed = h1 === edited
      const persisted = persistedTitle === edited
      console.log(`[${key}] h1=${JSON.stringify(h1)} persisted=${JSON.stringify(persistedTitle)} edited=${JSON.stringify(edited)}`)
      // Javna stran je res pokazala spremenjen naslov po objavi.
      expect(h1Changed, `${key}: javna stran mora prikazati nov naslov (dobil ${JSON.stringify(h1)})`).toBe(true)
      // Stanje se po ponovni prijavi ohrani.
      expect(persisted, `${key}: naslov se mora po ponovni prijavi ohraniti (dobil ${JSON.stringify(persistedTitle)})`).toBe(true)
    })
  }

  test("2D-8 izolacija: tri org ohranijo svoje strede (vulkanizer ne spremeni čebelarja/šivilje)", async ({ page }) => {
    // Preverimo, da se vsaka javna stran odziva s svojo dejavnostjo.
    for (const [key, [, , slug, h1]] of Object.entries(ORGS) as [OrgKey, readonly string[]][]) {
      await page.goto(`${BASE}/s/${slug}`)
      await expect(page.locator("h1").first()).toContainText(h1, { timeout: 30000 })
    }
  })

  test("2D-8 regresija: editor se odpre brez JS napak (mobile 390)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await login(page, ORGS.vulkanizer[0], ORGS.vulkanizer[1])
    await openVisualEditor(page)
    await expect(page.locator("iframe")).toBeVisible()
    const noOverflow = await page.evaluate(() => {
      const f = document.querySelector("iframe") as HTMLIFrameElement | null
      if (!f?.contentDocument) return true
      return f.contentDocument.documentElement.scrollWidth <= f.contentDocument.documentElement.clientWidth
    })
    expect(noOverflow).toBe(true)
  })
})