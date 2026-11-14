// Faza 2C-3 — browser E2E: RecordDetail zgodovina selitev.
// Login cb → records → družina → detail → lokacija → preseli → refresh → korekcija.
import { chromium } from "@playwright/test"

const BASE = process.env.PROJECT_URL || "http://localhost:3019"
function assert(c, m) { if (!c) throw new Error("FAIL: " + m) }

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const log = {}
  try {
    await page.goto(`${BASE}/login`)
    await page.getByLabel(/e-pošta/i).fill("cb@f631.test")
    await page.getByLabel(/geslo/i).fill("TestPass123!")
    await page.getByRole("button", { name: /prijava/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 40000 }).catch(() => {})
    await page.waitForTimeout(1800)
    await page.goto(`${BASE}/dashboard/records`)
    await page.waitForTimeout(2000)

    // tab "Čebelja družina" (bee-apiary: index 4)
    await page.getByRole("tab").nth(4).click()
    await page.waitForTimeout(1000)

    // najdi vrstico F2C3-Družina in odpri Podrobnosti (eye gumb)
    const row = page.locator("tr").filter({ hasText: "F2C3-Družina" }).first()
    assert(await row.count() > 0, "vrstica F2C3-Družina ni v tabeli")
    await row.getByRole("button", { name: /Podrobnosti/i }).click()
    await page.waitForTimeout(1600)
    const body = await page.locator("body").innerText()
    //1. trenutna lokacija
    assert(body.includes("F2C3-Panj-A"), "detail ne prikaže trenutne lokacije Panj-A")
    //2. zgodovina — pred prvo selitvijo še prazna (empty state)
    assert(/Ni še zabeleženih selitev/.test(body), "prazna zgodovina ni prikazana pred prvo selitvijo")
    log.step1_lokacija = "F2C3-Panj-A ok"
    log.step2_empty = true

    // nova selitev → Panj-B
    await page.getByRole("button", { name: /Preseli družino/i }).first().click()
    await page.waitForTimeout(600)
    await page.selectOption('select[name="toHive"]', { label: "F2C3-Panj-B" })
    await page.fill('input[name="movedAt"]', "2026-05-20")
    await page.fill('input[name="reason"]', "Browser E2E")
    await page.getByRole("button", { name: /Potrdi selitev/i }).click()
    await page.waitForTimeout(2000)
    //3+4. nova lokacija + zgodovina po akciji (re-fetch)
    const body2 = await page.locator("body").innerText()
    assert(/F2C3-Panj-B/.test(body2), "po selitvi detail ne prikaže Panj-B")
    assert(/Browser E2E/.test(body2), "razlog ni prikazan")
    log.selitev = "Panj-B ok"

    // Zapri detail, refresh strani
    await page.getByRole("button", { name: /Zapri/i }).first().click().catch(() => {})
    await page.waitForTimeout(500)
    await page.reload()
    await page.waitForTimeout(2200)
    await page.getByRole("tab").nth(4).click()
    await page.waitForTimeout(900)
    const row2 = page.locator("tr").filter({ hasText: "F2C3-Družina" }).first()
    assert(await row2.count() > 0, "po refresh ni vrstice")
    await row2.getByRole("button", { name: /Podrobnosti/i }).click()
    await page.waitForTimeout(1800)
    const body3 = await page.locator("body").innerText()
    assert(/F2C3-Panj-B/.test(body3), "po refresh lokacija ni Panj-B")
    assert(/Začetno evidentirano stanje/.test(body3), "po selitvi se baseline NE prikaže (napaka)")
    log.refresh = "Panj-B ohranjeno; baseline + selitev v časovnici"

    console.log("PASS", JSON.stringify(log, null, 2))
    try { await page.screenshot({ path: "scripts/f2c3-detail.png" }) } catch {}
  } catch (e) {
    console.error("FAIL", e.message)
    process.exit(1)
  } finally {
    await browser.close()
  }
})().catch((e) => { console.error("FAIL", e.message); process.exit(1) })