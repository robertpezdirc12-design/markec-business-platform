// Faza 2C-1 — browser E2E: večvrstni picker (Opravilo → postaja/panj/družina),
// shranjevanje, ponovno odprtje, prikaz nazivov.
import { chromium } from "@playwright/test"

const BASE = process.env.PROJECT_URL || "http://localhost:3017"

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const log = {}
  const step = (k, v) => { log[k] = v; console.log("STEP", k, JSON.stringify(v)) }
  try {
    await page.goto(`${BASE}/login`)
    await page.getByLabel(/e-pošta/i).fill("cb@f631.test")
    await page.getByLabel(/geslo/i).fill("TestPass123!")
    await page.getByRole("button", { name: /prijava/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 40000 }).catch(() => {})
    await page.waitForTimeout(1800)
    await page.goto(`${BASE}/dashboard/records`)
    await page.waitForTimeout(2000)

    // tab "Opravilo" (bee-apiary vrstni red: 9)
    await page.getByRole("tab").nth(9).click()
    await page.waitForTimeout(900)
    await page.getByRole("button", { name: /^Dodaj vnos/i }).first().click()
    await page.waitForTimeout(1100)
    // entityReference multi select: id record-target_ref
    const sel = page.locator("#record-target_ref")
    step("multi-select-obstaja", await sel.count() > 0 ? true : false)
    // optgroup naslovi (naslovi so vidni kot optgroup element)
    const groups = await sel.locator("optgroup").evaluateAll((gs) => gs.map((g) => g.getAttribute("label")))
    step("optgroup-tipi", groups)
    // izberi eno (colony, če obstaja) — vrednost "colony::id"
    const options = await page.locator('#record-target_ref option').evaluateAll((os) => os.map((o) => ({ value: o.getAttribute("value"), text: (o.textContent||"").trim() })))
    const colonyOpt = options.find((o) => o.text && o.text.includes("XC-Družina"))
    step("multi-opcije", options.slice(0, 8))
    let saved = false
    if (colonyOpt && colonyOpt.value) {
      await sel.selectOption(colonyOpt.value)
      // zapolni datuma + vrsto, ki sta required
      await page.locator("#record-task_date").fill("2026-04-01")
      await page.locator("select#record-task_type, #record-task_type, [id=record-task_type]").first().evaluate((el) => {}).catch(() => {})
      // task_type je select s "Pregled" — izberi ce obstaja
      const tt = page.locator("#record-task_type")
      if (await tt.count().catch(() => 0)) await tt.selectOption({ label: "Pregled" }).catch(() => {})
      await page.getByRole("button", { name: /^Shrani$/i }).first().click()
      await page.waitForTimeout(1800)
      step("shranjena-vrstica", (await page.locator("body").innerText()).includes("2026-04-01") )
      // ponovno odpri (edit)
      const row = page.locator("tr").filter({ hasText: "XC-Družina" }).first()
      if (await row.count()) {
        await row.getByRole("button", { name: /^Uredi vnos$/i }).click()
        await page.waitForTimeout(900)
        const reopened = await page.locator("#record-target_ref").inputValue()
        step("reopen-multi-vrednost", reopened ? reopened : "(prazno)")
        saved = reopened === colonyOpt.value
      }
    }
    step("shranjen-multi-izbran-posodobljen", saved)
    console.log("RESULT", JSON.stringify(log, null, 2))
  } finally {
    await browser.close()
  }
})().catch((e) => { console.error("ERR_FATAL", e.message); process.exit(1) })