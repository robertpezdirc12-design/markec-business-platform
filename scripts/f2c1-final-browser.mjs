// Faza 2C-1 — ZAKLJUČNI browser E2E: polna pot multi-reference (Opravilo → Čebelja družina).
// Poprava v primerjavi s prejšnjim: zapis poiščemo po unikatnem text markerju v `target`
// (text polje v tabeli), NE po target_ref (ki je izven prvih 4 stolpcev). Trde asercije:
// ob neuspehu test vrne FAIL (throw → exit!=0). Preveri shranjeno vrednost, reopen, refresh.
import { chromium } from "@playwright/test"

const BASE = process.env.PROJECT_URL || "http://localhost:3018"
const MARK = `XC2-FIN-${Date.now().toString(36)}`
const COLONY_TITLE = "XC2-Družina"

// Minor pobliže: Opravilo tab je index 9 (bee-apiary order v /dashboard/records).
function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg)
}

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const log = []
  try {
    await page.goto(`${BASE}/login`)
    await page.getByLabel(/e-pošta/i).fill("cb@f631.test")
    await page.getByLabel(/geslo/i).fill("TestPass123!")
    await page.getByRole("button", { name: /prijava/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 40000 }).catch(() => {})
    await page.waitForTimeout(1800)
    await page.goto(`${BASE}/dashboard/records`)
    await page.waitForTimeout(2000)

    // 1. Odpri Opravilo
    await page.getByRole("tab").nth(9).click()
    await page.waitForTimeout(1000)

    // 2. Dodaj opravilo + izberi čebeljo družino v target_ref
    await page.getByRole("button", { name: /^Dodaj vnos/i }).first().click()
    await page.waitForTimeout(1100)
    await page.locator("#record-task_date").fill("2026-05-15")
    await page.locator("#record-target").fill(MARK) // unikaten text marker (v tabeli)
    const sel = page.locator("#record-target_ref")
    assert((await sel.count()) > 0, "target_ref select ni prisoten")
    const colonyOption = sel.locator("option").filter({ hasText: COLONY_TITLE })
    assert((await colonyOption.count()) > 0, `družina "${COLONY_TITLE}" ni v opcijah target_ref`)
    const colonyVal = (await colonyOption.first().getAttribute("value")) || ""
    assert(/^colony::/.test(colonyVal), "vrednost družine ni v obliki colony::id")
    await sel.selectOption(colonyVal)
    await page.getByRole("button", { name: /^Shrani$/i }).first().click()
    await page.waitForTimeout(1800)
    assert((await page.locator("div[role=dialog]").count()) === 0, "po shranitvi dialog ni zaprt")
    log.push("created row: " + MARK)
    // vrstica z markerjem je v seznamu
    assert((await page.locator("tr").filter({ hasText: MARK }).count()) > 0, "zapis ni viden v tabeli")

    // 3. Ponovno odpri isto opravilo (po text markerju v target → row)
    const row = page.locator("tr").filter({ hasText: MARK }).first()
    await row.getByRole("button", { name: /^Uredi vnos$/i }).click()
    await page.waitForTimeout(1000)
    const reopenedVal = await page.locator("#record-target_ref").inputValue()
    const reopenedLabel = await page.locator("#record-target").inputValue()
    log.push("reopen target_ref = " + reopenedVal)
    log.push("reopen target     = " + reopenedLabel)
    // 4. Preveri pravilen naziv in tip za izbrano vrednost (najdi option z value=reopenedVal)
    const matchedText = await page
      .locator(`#record-target_ref option[value="${reopenedVal}"]`)
      .getAttribute("value")
    assert(!!matchedText, "izbrana opcija ne obstaja v selectu po reopen")
    const optLabel = await page
      .locator(`#record-target_ref option[value="${reopenedVal}"]`)
      .innerText()
    // optgroup label tipa = del accessible; vidimo celo opcijo (text)
    log.push("reopen option label = " + optLabel.trim())
    // 5. Vrednost se ujema s tisto, ki smo jo shranili pri create
    assert(reopenedVal === colonyVal, `reopen vrednost se ne ujema s shranjeno (${reopenedVal} vs ${colonyVal})`)
    // zapri brez sprememb
    await page.getByRole("button", { name: /^Prekliči$/i }).first().click()
    await page.waitForTimeout(500)

    // 6. Refresh strani → po reloadu poišči isti zapis in preveri da je reference ohranjena
    await page.reload()
    await page.waitForTimeout(2200)
    await page.getByRole("tab").nth(9).click()
    await page.waitForTimeout(1000)
    const rowRefresh = page.locator("tr").filter({ hasText: MARK }).first()
    assert((await rowRefresh.count()) > 0, "po refresh ni vrstice (zapis manjka po reloadu)")
    await rowRefresh.getByRole("button", { name: /^Uredi vnos$/i }).click()
    await page.waitForTimeout(1000)
    const refreshVal = await page.locator("#record-target_ref").inputValue()
    log.push("refresh target_ref = " + refreshVal)
    assert(refreshVal === colonyVal, `po refresh vrednost ni ohranjena (${refreshVal} vs ${colonyVal})`)
    await page.getByRole("button", { name: /^Prekliči$/i }).first().click().catch(() => {})

    console.log("PASS", JSON.stringify({ marker: MARK, colonyVal, log }, null, 2))
  } catch (e) {
    console.error("FAIL", e.message)
    await page.screenshot({ path: "scripts/f2c1-final-fail.png" }).catch(() => {})
    process.exit(1)
  } finally {
    await browser.close()
  }
})().catch((e) => { console.error("FAIL", e.message); process.exit(1) })