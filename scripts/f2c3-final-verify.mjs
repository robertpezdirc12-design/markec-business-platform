// Faza 2C-3 — ZAKLJUČNA PREVERBA
// DEL A: browser korekcija (desktop 1280) — original nespremenjen + correction dogodek.
// DEL B: mobilni E2E (390px) — detail, timeline, forma, korakcija, brez overflow.
import { chromium } from "@playwright/test"

const BASE = process.env.PROJECT_URL || "http://localhost:3020"
function assert(c, m) { if (!c) throw new Error("FAIL: " + m) }

async function login(page) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/e-pošta/i).fill("cb@f631.test")
  await page.getByLabel(/geslo/i).fill("TestPass123!")
  await page.getByRole("button", { name: /prijava/i }).click()
  await page.waitForURL(/dashboard/, { timeout: 40000 }).catch(() => {})
  await page.waitForTimeout(1800)
  await page.goto(`${BASE}/dashboard/records`)
  await page.waitForTimeout(2000)
  await page.getByRole("tab").nth(4).click() // Čebelja družina
  await page.waitForTimeout(900)
}

async function openColonyDetail(page) {
  const row = page.locator("tr").filter({ hasText: "F2V-Družina" }).first()
  await row.waitFor({ state: "visible", timeout: 15000 }).catch(() => {})
  assert(await row.count() > 0, "vrstica F2V-Družina ni v tabeli")
  await row.getByRole("button", { name: /Podrobnosti/i }).click()
  await page.waitForTimeout(2000)
}

;(async () => {
  const browser = await chromium.launch()
  const log = {}
  try {
    // ============ DEL A — korekcija (desktop) ============
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    await login(page)
    await openColonyDetail(page)
    let body = await page.locator("body").innerText()
    assert(/F2V-Panj-A/.test(body), "A1 trenutna lokacija mora biti Panj-A")

    // A2: nova selitev A→B
    await page.getByRole("button", { name: /Preseli družino/i }).first().click()
    await page.waitForTimeout(600)
    await page.selectOption('select[name="toHive"]', { label: "F2V-Panj-B" })
    await page.fill('input[name="movedAt"]', "2026-06-01")
    await page.getByRole("button", { name: /Potrdi selitev/i }).click()
    await page.waitForTimeout(4000)
    body = await page.locator("body").innerText()
    assert(/F2V-Panj-B/.test(body), "A2 po selitvi lokacija ni Panj-B")

    // A3: refresh + reopen
    await page.reload(); await page.waitForTimeout(2200)
    await page.getByRole("tab").nth(4).click(); await page.waitForTimeout(900)
    await openColonyDetail(page)
    body = await page.locator("body").innerText()
    assert(/F2V-Panj-B/.test(body), "A3 po refresh lokacija ni ohranjeno Panj-B")
    assert(/Začetno evidentirano stanje/.test(body), "A3 baseline ni viden")
    // original (selitev v B) je prisoten
    const hasFromAtoB = body.includes("F2V-Panj-A") && body.includes("F2V-Panj-B")
    assert(hasFromAtoB, "A3 original premik A→B ni viden")

    // A4: Popravi na prvi selitvi (event A→B) → cilj Panj-C
    // poiščemo gumb "Popravi" (korekcijski dogodki ga nimajo; izberemo prvega)
    const correctBtn = page.getByRole("button", { name: /^Popravi$/i }).first()
    assert(await correctBtn.count() > 0, "A4 ni gumba Popravi")
    await correctBtn.click()
    await page.waitForTimeout(700)
    // target select v korekcijski formi (trenutno B) → izberi C
    const corrSelects = page.locator("form select")
    const lastSelect = corrSelects.last()
    await lastSelect.selectOption({ label: "F2V-Panj-C" })
    await page.fill('input[placeholder=""], form input[type="text"]', "").catch(()=>{})
    // razlog popravka = text input v korekcijski formi (po target) — poiskupimo zadnji input
    const inputs = page.locator("form input[type=text]")
    if (await inputs.count()) await inputs.last().fill("korekcija cilja")
    await page.getByRole("button", { name: /Potrdi popravek/i }).click()
    await page.waitForTimeout(2000)
    body = await page.locator("body").innerText()
    // A5: trenutna lokacija postal C
    assert(/F2V-Panj-C/.test(body), "A5 po korekciji trenutna lokacija ni Panj-C")
    // originalni premik A→B še viden
    assert(body.includes("F2V-Panj-A") && body.includes("F2V-Panj-B"), "A6 original A→B naj ne izgine")
    // correction dogodek in korekcija razlog
    assert(/Korekcija/.test(body), "A7 correction dogodek / oznacba korekcije ni prikazana")
    log.korekcija = "ok: original A→B viden, korC nov dogodek, lokacija C"

    // A8: refresh → timeline ostane + lokacija C
    await page.reload(); await page.waitForTimeout(2200)
    await page.getByRole("tab").nth(4).click(); await page.waitForTimeout(900)
    await openColonyDetail(page)
    body = await page.locator("body").innerText()
    assert(/F2V-Panj-C/.test(body), "A8 po refresh lokacija ni C")
    assert(/Korekcija/.test(body), "A8 po refresh correction dogodek ni viden")
    assert(body.includes("F2V-Panj-A") && body.includes("F2V-Panj-B"), "A8 original še viden")
    log.refresh_after_correction = "ok"
    await page.screenshot({ path: "scripts/f2c3-desktop-correction.png" }).catch(()=>{})
    await page.close()

    // ============ DEL B — mobile 390 ============
    const mp = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await login(mp)
    await openColonyDetail(mp)
    await mp.waitForTimeout(800)
    // B: preveri lokacijo in timeline (po korekciji lokacija C)
    const mb = await mp.locator("body").innerText()
    assert(/F2V-Panj-C/.test(mb), "B trenutna lokacija na mobile ni prikazana")
    assert(/Zgodovina selitev/.test(mb), "B timeline naslov ni viden na mobile")
    assert(/Korekcija/.test(mb), "B correction dogodek ni viden na mobile")

    // B2: preveri da ni brez vodoravnega drsenja
    const scrollWidth = await mp.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await mp.evaluate(() => document.documentElement.clientWidth)
    assert(scrollWidth <= clientWidth + 1, `B horizontal overflow: scroll=${scrollWidth} client=${clientWidth}`)
    log.mobile_no_hscroll = `scroll=${scrollWidth} client=${clientWidth}`

    // B3: odpri formo za selitev na mobile in zapri dialog
    await mp.getByRole("button", { name: /Preseli družino/i }).first().click()
    await mp.waitForTimeout(600)
    assert(await mp.locator('select[name="toHive"]').count() > 0, "B forma selitve ni vidna (390)")
    await mp.getByRole("button", { name: /Prekliči/i }).first().click().catch(()=>{})
    await splashClose(mp)
    await mp.screenshot({ path: "scripts/f2c3-mobile.png" }).catch(()=>{})
    log.mobile = "ok: lokacija C, timeline, korekcija, brez overflow, forma dostopna"
    await mp.close()

    console.log("PASS", JSON.stringify(log, null, 2))
  } catch (e) {
    console.error("FAIL", e.message)
    process.exit(1)
  } finally {
    await browser.close()
  }
})().catch((e) => { console.error("FAIL", e.message); process.exit(1) })

async function splashClose(page) {
  // mobilni Dialog zapiranje prek 'Zapri' v footer; tk da ne blok
  await page.getByRole("button", { name: /Zapri/i }).first().click().catch(() => {})
  await page.keyboard.press("Escape").catch(() => {})
}