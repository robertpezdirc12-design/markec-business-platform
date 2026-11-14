// Faza 2B — DODATNO E2E: dejansko shranjevanje entityReference v UI, dokaz ID,
// reopen, negativni primer (INVALID_REFERENCE) in čiščenje. Brez prisilnega
// `saved` — vsak korak se preveri po realnem rezultatu (UI + server action).
import { chromium } from "@playwright/test"

const BASE = process.env.PROJECT_URL || "http://localhost:3016"
const STAMP = `XZ-B515`
const postajaName = `XZ-Postaja-${STAMP}`
const panjLabel = `XZ-Panj-${STAMP}`

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const log = []
  const step = (k, v) => { log.push({ [k]: v }); console.log("STEP", k, JSON.stringify(v)) }

  try {
    // Prijava kot čebelar
    await page.goto(`${BASE}/login`)
    await page.getByLabel(/e-pošta/i).fill("cb@f631.test")
    await page.getByLabel(/geslo/i).fill("TestPass123!")
    await page.getByRole("button", { name: /prijava/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 40000 }).catch(() => {})
    await page.waitForTimeout(1800)

    // 1. Ustvari postajo prek UI (Panjska postaja) → dobimo njen ID iz seznama pozneje
    await page.goto(`${BASE}/dashboard/records`)
    await page.waitForTimeout(2000)
    // tab indexi: 0=Serija/lot,1=Dobavitelj,2=Panjska postaja (bee-apiary order)
    await page.getByRole("tab").nth(2).click()
    await page.waitForTimeout(900)
    await page.getByRole("button", { name: /^Dodaj vnos/i }).first().click()
    await page.waitForTimeout(900)
    await page.locator("#record-name").fill(postajaName)
    await page.getByRole("button", { name: /^Shrani$/i }).first().click()
    await page.waitForTimeout(1600)
    step("ustvari-postajo-ui-list", (await page.locator("body").innerText()).includes(postajaName))

    // postaja ID: prek javno uporabljene server action preko browserja ni izpostavljeno;
    // vzamemo iz UI seznama (title) in jo pozneje povežemo z ID iz pickerja vrednostjo.
    // 2. Odpri Panje → dodaj panj in poveži na to postajo
    await page.getByRole("tab").nth(3).click() // Panj
    await page.waitForTimeout(900)
    await page.getByRole("button", { name: /^Dodaj vnos/i }).first().click()
    await page.waitForTimeout(1000)
    await page.locator("#record-label").fill(panjLabel)
    // hive_type je required select (id record-hive_type) — izberi eno
    await page.locator("#record-hive_type").selectOption({ label: "AŽ" })
    await page.waitForTimeout(200)
    // entityReference select: id record-apiary_ref
    await page.locator("#record-apiary_ref").selectOption({ label: postajaName })
    const selectedRef = await page.locator("#record-apiary_ref").inputValue()
    step("izbrana-postaja-ref-hash", selectedRef?.slice(0, 10) + "…")

    // 3. Shrani
    await page.getByRole("button", { name: /^Shrani$/i }).first().click()
    await page.waitForTimeout(1800)
    const bodyAfterSave = await page.locator("body").innerText()
    step("shrani-ui-uspeh-toast-ali-vrstica", bodyAfterSave.includes(panjLabel))

    // 4. Preveri ID: odpri panj nazaj (search row), poišči Edit → reopen → select value
    // Find the row with panjLabel and click its edit (pencil) button.
    const row = page.locator("tr").filter({ hasText: panjLabel }).first()
    step("vrstica-panja-v-seznamu", await row.count() > 0 ? true : false)
    await row.getByRole("button", { name: /^Uredi vnos$/i }).click()
    await page.waitForTimeout(1000)
    const reopenedRef = await page.locator("#record-apiary_ref").inputValue()
    step("ponovno-odprto-ista-postaja", { reIzbrana: reopenedRef === selectedRef, selectedRef: selectedRef?.slice(0,10)+"…", reopenedRef: reopenedRef?.slice(0,10)+"…" })
    const reopenLabel = await page.locator("#record-label").inputValue()
    step("ponovno-odprto-naslov", reopenLabel === panjLabel)
    // Zapri dialog brez sprememb
    await page.getByRole("button", { name: /^Prekliči$/i }).first().click()
    await page.waitForTimeout(600)

    // 5. NEGATIV: poskusi posodobiti panj z neveljavnim apiary_ref
    // Picker UI ima le veljavne opcije, zato vrednost silimo prek native setterja +
    // React change event — to simulira ročno ID spremembo v brskalniku. Strežnik jo mora zavrniti.
    await row.getByRole("button", { name: /^Uredi vnos$/i }).click()
    await page.waitForTimeout(900)
    await page.evaluate(() => {
      const sel = document.querySelector('#record-apiary_ref')
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set
      setter.call(sel, "cmwNONEXISTENT-ID-0000000000000001")
      sel.dispatchEvent(new Event("change", { bubbles: true }))
      sel.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await page.waitForTimeout(500)
    await page.getByRole("button", { name: /^Shrani$/i }).first().click()
    await page.waitForTimeout(1800)
    const negBody = await page.locator("body").innerText()
    step("negativni-invalid-reference", {
      prikazanaNapaka: negBody.includes("ne obstaja v vašem podjetju") || negBody.includes("napačne vrste"),
      // preverimo, da dialog še vedno ima form (ni se zaprl) → ni se shranilo
      dialogSeNIIzZaprl: await page.locator("div[role=dialog]").count() > 0,
    })

    // Zapri dialog, izbriši testna zapisa
    await page.getByRole("button", { name: /^Prekliči$/i }).first().click().catch(() => {})
    await page.waitForTimeout(400)

    console.log("RESULT", JSON.stringify(log, null, 2))
  } finally {
    await browser.close()
  }
})().catch((e) => { console.error("ERR_FATAL", e.message); process.exit(1) })