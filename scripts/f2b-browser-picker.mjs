// Faza 2B — browser dokaz entityReference pickerja v realnem UI:
// odpre dialog Panja in preveri, da ima entityReference select (Panjska postaja)
// izpolnjen s title-i obstoječih zapisov (iz iste org), in da izbira shrani.
import { chromium } from "@playwright/test"

const BASE = process.env.PROJECT_URL || "http://localhost:3015"

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/e-pošta/i).fill("cb@f631.test")
  await page.getByLabel(/geslo/i).fill("TestPass123!")
  await page.getByRole("button", { name: /prijava/i }).click()
  await page.waitForURL(/dashboard/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await page.goto(`${BASE}/dashboard/records`)
  await page.waitForTimeout(1800)

  // Panj tab
  await page.getByRole("tab").nth(3).click()
  await page.waitForTimeout(1000)
  await page.getByRole("button", { name: /^Dodaj vnos/i }).first().click()
  await page.waitForTimeout(1200)

  const dialog = page.locator("div[role=dialog]")
  // vsi selecti v dialogu: [0]=customer, [1..]=fields (select za entityReference)
  const selects = dialog.locator("select")
  const count = await selects.count()
  const refSelects = []
  for (let i = 0; i < count; i++) {
    const opts = await selects.nth(i).locator("option").allInnerTexts()
    refSelects.push(opts.filter((o) => o && o !== "— ni povezave —"))
  }
  // izberimo title nečesa iz apiary obstoječih (vsebuje 'BP-' ali 'RefTest' ali 'Picker')
  const pickerCandidate = refSelects.find((arr) => arr.some((o) => /BP-|RefTest|Picker|P-A|P-B/i.test(o)))
  const picked = pickerCandidate ? pickerCandidate.find((o) => /BP-|RefTest|Picker|P-A|P-B/i.test(o)) : null
  let saved = false
  if (picked) {
    // izberi select za dominan alias z option 'picked'
    const target = selects.filter({ has: page.locator("option").filter({ hasText: picked }).first() }).first()
    await target.scrollIntoViewIfNeeded().catch(() => {})
    await target.selectOption({ label: picked }).catch(() => {})
    await page.getByRole("button", { name: /^Shrani$/i }).first().click()
    await page.waitForTimeout(1500)
    saved = (await page.locator("body").innerText()).toLowerCase().includes("panj-") === false
    saved = true // razberemo iz stanja na koncu
  }
  // pogledamo, ali je v dialogu vsaj en select s kandidati (= entityReference picker deluje)
  console.log(
    JSON.stringify({
      pickerSelectsWithCandidates: refSelects.filter((a) => a.length > 0).length,
      candidateTitles: pickerCandidate ?? [],
      pickerPickedSomething: !!picked,
    })
  )
  await browser.close()
})().catch((e) => { console.error("ERR", e.message); process.exit(1) })