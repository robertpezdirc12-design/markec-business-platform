// Faza 2B — browser dokaz: UI povezava postaja → panj → družina prek entityReference
// pickerjev (izberi iz obstoječih recordov, ne ročno besedilo).
import { chromium } from "@playwright/test"

const BASE = process.env.PROJECT_URL || "http://localhost:3015"

async function clickTab(page, index) {
  const tab = page.getByRole("tab").nth(index)
  await tab.click()
  await page.waitForTimeout(900)
}
async function addWithRef(page, selectLabelRe, pickTitle, otherKey, otherVal) {
  // klik "Dodaj vnos"
  const add = page.getByRole("button", { name: /^Dodaj vnos/i }).first()
  await add.click()
  await page.waitForTimeout(700)
  // izpolni naslov (prvi text vnos — key je label; pošljemo name/label)
  const textInput = page.locator("input[type=text]").first()
  if (await textInput.isVisible().catch(() => false)) await textInput.fill(otherVal)
  // najdi entityReference select (ima label ki vsebuje selectLabelRe)
  const sel = page.locator("select").filter({ has: page.getByRole("option", { name: /^— ni povezave —$/ }).first() }).first()
  const lastLabel = page.locator("label").filter({ hasText: selectLabelRe }).first()
  // poiščimo select povezan z zadnjim labelom (sibling) — zelo robustno:
  const allSels = page.locator("select")
  const n = await allSels.count()
  let picked = selectLabelRe
  const chosen = pickTitle
  // izberemo v selectu, ki je neposredno po labelu (entityReference select je en v dialogu za ta field)
  const dialogSels = page.locator("div[role=dialog] select")
  // google: entityReference select — najdemo select, katerega option vsebuje pickTitle
  let target = null
  for (let i = 0; i < (await dialogSels.count()); i++) {
    const s = dialogSels.nth(i)
    const opts = await s.locator("option").allInnerTexts()
    if (opts.some((o) => o === pickTitle)) { target = s; break }
  }
  if (!target) {
    await page.screenshot({ path: "scripts/f2b-no-select.png" })
    return { ok: false, reason: `select za ${selectLabelRe} ni najden`, labels: await page.locator("label").allInnerTexts() }
  }
  await target.selectOption({ label: pickTitle })
  await page.waitForTimeout(300)
  const save = page.getByRole("button", { name: /^Shrani$/i }).first()
  await save.click()
  await page.waitForTimeout(1200)
  return { ok: true, picked: chosen }
}

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const out = { steps: [] }
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/e-pošta/i).fill("cb@f631.test")
  await page.getByLabel(/geslo/i).fill("TestPass123!")
  await page.getByRole("button", { name: /prijava/i }).click()
  await page.waitForURL(/dashboard/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await page.goto(`${BASE}/dashboard/records`)
  await page.waitForTimeout(1600)
  console.log("TABS_MODULE", JSON.stringify(await page.getByRole("tab").allInnerTexts()))

  // 1) Panjska postaja
  // tab indexi iz orderja bee-apiary entitet (batch=0, supplier=1, apiary=2, hive=3, colony=4, inspection=5)
  await clickTab(page, 2)
  const add1 = page.getByRole("button", { name: /^Dodaj vnos/i }).first()
  await add1.click(); await page.waitForTimeout(700)
  await page.locator("input[type=text]").first().fill("BP-501")
  await page.getByRole("button", { name: /^Shrani$/i }).first().click()
  await page.waitForTimeout(1500)
  out.steps.push({ step: "apiary creado", ok: (await page.locator("body").innerText()).includes("BP-501"), name: "BP-501" })

  // 2) Panj s povezavo na postajo
  await clickTab(page, 3)
  const r2 = await addWithRef(page, /Panjska postaja \(izberi\)/, "BP-501", "label", "Panj-BP-501")
  out.steps.push({ step: "hive linked", ...r2 })

  // 3) Družina v panju
  await clickTab(page, 4)
  const r3 = await addWithRef(page, /Panj \(izberi\)/, "Panj-BP-501", "label", "Družina-BP-501")
  out.steps.push({ step: "colony linked", ...r3 })

  // 4) Pregled družine
  await clickTab(page, 5)
  const r4 = await addWithRef(page, /Čebelja družina \(izberi\)/, "Družina-BP-501", "colony", "Pr-Družina-BP-501")
  out.steps.push({ step: "inspection linked", ...r4 })

  const body = await page.locator("body").innerText()
  out.hasRecords = { BP501: body.includes("BP-501"), PanjBP501: body.includes("Panj-BP-501"), DruzinaBP501: body.includes("Družina-BP-501") }
  console.log(JSON.stringify(out, null, 2))
  await browser.close()
})().catch((e) => { console.error("ERR", e.message); process.exit(1) })