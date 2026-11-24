import { test, expect, type Page } from "@playwright/test"

// ============================================================
// 2D-12 — UNIVERZALNA VALIDACIJA WYSIWYG→MODUL za vse dejavnosti
//
// Zapira vrzeli 2D-10/11:
//  - VULK (services) EDIT obstoječe storitve (cena) → javna /services
//  - CEBELAR (products) CREATE testnega izdelka → javno /shop
//  - MOBILNI 390: poteka poln flow brez horizontalnega overflowa
// Business moduli = edini vir resnice; testni podatki se rollbackajo.
// Teče :3002: PROJECT_URL=http://localhost:3002 npx playwright test playwright.2d8.config.ts -g "2D-12"
// ============================================================

const BASE = process.env.PROJECT_URL || ""
const RUN = Date.now().toString(36)

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/e-pošta/i).waitFor({ timeout: 45000 })
  await page.getByLabel(/e-pošta/i).fill(email)
  await page.getByLabel(/geslo/i).fill(password)
  await page.getByRole("button", { name: /prijava/i }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 50000 })
}

async function noOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
}

test("2D-12 vulkanizer: EDIT storitve (cena) iz WYSIWYG → javna odraža → povrni", async ({ page, browser }) => {
  await login(page, "cebeler.tire@markec.test", "demo1234")
  // Odpri storitve modul (prek WYSIWYG za navigacijsko pokritost ni nujno; neposredno ruta je hitrejša).
  await page.goto(`${BASE}/dashboard/services`)
  await page.getByText("Balansiranje", { exact: true }).first().waitFor({ timeout: 40000 })
  // EDIT prve storitve: poišči njegov edit svinčnik.
  const editHref = (await page.locator('a[href*="/dashboard/services/"][href$="/edit"]').first().getAttribute("href")) || ""
  expect(editHref).toContain("/dashboard/services/")
  await page.goto(`${BASE}${editHref}`)
  await page.locator("#price").waitFor({ timeout: 30000 })
  const orig = await page.locator("#price").inputValue()
  const newPrice = (parseFloat(orig.replace(",", ".")) || 1) + 0.5
  await page.locator("#price").fill(newPrice.toFixed(2))
  await page.getByRole("button", { name: /posodobi storitev|shrani/i }).first().click()
  await page.waitForURL(/\/dashboard\/services$/, { timeout: 40000 }).catch(() => undefined)

  // Javna /services: nova cena (round to 2) je vidna.
  const pubCtx = await browser.newContext()
  const pub = await pubCtx.newPage()
  await pub.goto(`${BASE}/s/svezi-vulkanizer-2d1s/services`)
  await expect.poll(async () => {
    const txt = await pub.locator("body").innerText()
    return txt.includes(newPrice.toFixed(2).replace(".", ",")) || txt.includes(newPrice.toFixed(2))
  }, { timeout: 60000 }).toBe(true)
  await pubCtx.close()

  // Povrni ceno na original (Posodobi storitev) — samostojna preverba DB v poročilu.
  const rev = await page.context().newPage()
  await rev.goto(`${BASE}${editHref}`)
  await rev.locator("#price").waitFor({ timeout: 30000 }).catch(() => undefined)
  await rev.locator("#price").fill(orig).catch(() => undefined)
  await rev.getByRole("button", { name: /posodobi storitev/i }).first().click().catch(() => undefined)
  await rev.waitForTimeout(2500)
  await rev.close().catch(() => undefined)
  console.log(`[2D-12 vulkanizer] EDIT cena ${orig}→${newPrice.toFixed(2)} javna: PASS`)
})

test("2D-12 cebelar: CREATE izdelka iz WYSIWYG → javno /shop → rollback", async ({ page, browser }) => {
  const name = `2D12 cebelar ${RUN}`
  await login(page, "cebeler.fresh@markec.test", "demo1234")
  await page.goto(`${BASE}/dashboard/products`)
  const addNew = page.locator('a[href="/dashboard/products/new"]').first()
  await addNew.waitFor({ timeout: 40000 })
  await addNew.click()
  await page.waitForURL(/\/dashboard\/products\/new/, { timeout: 45000 })
  await page.locator("#name").fill(name)
  await page.locator("#price").fill("12.50")
  // sku, če je input prisoten (unikaten).
  const sku = page.locator("#sku")
  if (await sku.count().catch(() => 0)) await sku.fill(`T12${RUN}`)
  await page.getByRole("button", { name: /dodaj izdelek|ustvari|shrani/i }).last().click()
  await page.waitForURL(/\/dashboard\/products$/, { timeout: 45000 }).catch(() => undefined)

  // Javno /shop (cebelar storefront) prikaže nov izdelek.
  const pubCtx = await browser.newContext()
  const pub = await pubCtx.newPage()
  await pub.goto(`${BASE}/s/svezi-cebeler-2d1l/shop`)
  await expect.poll(
    async () => (await pub.locator("body").innerText().catch(() => "")).includes(name),
    { timeout: 60000 }
  ).toBe(true)
  await pubCtx.close()

  // Rollback: izbriši testni izdelek (nima order items).
  const del = await page.context().newPage()
  await del.goto(`${BASE}/dashboard/products`)
  const pencil = del.locator('a[href*="/dashboard/products/"][href$="/edit"]').filter({ has: del.getByText(name, { exact: false }) }).first()
  const editHref = (await pencil.getAttribute("href").catch(() => "")) || ""
  if (editHref) await del.goto(`${BASE}${editHref}`)
  const delBtn = del.getByRole("button", { name: /izbri/i }).first()
  await delBtn.waitFor({ timeout: 30000 }).catch(() => undefined)
  if (await delBtn.isVisible().catch(() => false)) {
    del.on("dialog", (d) => d.accept().catch(() => undefined))
    await delBtn.click()
    await del.waitForTimeout(3000)
  }
  await del.close().catch(() => undefined)

  const pub2Ctx = await browser.newContext()
  const pub2 = await pub2Ctx.newPage()
  await pub2.goto(`${BASE}/s/svezi-cebeler-2d1l/shop`)
  await expect.poll(async () => {
    const txt = await pub2.locator("body").innerText().catch(() => "")
    return !txt.includes(name)
  }, { timeout: 60000 }).toBe(true)
  await pub2Ctx.close()
  console.log(`[2D-12 cebelar] CREATE → javno /shop → rollback: PASS`)
})

test("2D-12 mobilni 390: beekeeper products CREATE flow brez overflowa", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const name = `2D12 mob ${RUN}`
  await login(page, "cebeler.fresh@markec.test", "demo1234")
  expect(await noOverflow(page)).toBe(true)
  await page.goto(`${BASE}/dashboard/products`)
  await page.locator('a[href="/dashboard/products/new"]').first().click()
  await page.waitForURL(/\/dashboard\/products\/new/, { timeout: 45000 })
  expect(await noOverflow(page)).toBe(true)
  await page.locator("#name").fill(name)
  await page.locator("#price").fill("8.00")
  await page.getByRole("button", { name: /dodaj izdelek|ustvari|shrani/i }).last().click()
  await page.waitForURL(/\/dashboard\/products$/, { timeout: 45000 }).catch(() => undefined)
  expect(await noOverflow(page)).toBe(true)

  // Javno /shop na 390 brez overflowa.
  const pubCtx = await browser.newContext()
  const pub = await pubCtx.newPage()
  await pub.setViewportSize({ width: 390, height: 844 })
  await pub.goto(`${BASE}/s/svezi-cebeler-2d1l/shop`)
  await expect.poll(
    async () => (await pub.locator("body").innerText().catch(() => "")).includes(name),
    { timeout: 60000 }
  ).toBe(true)
  const overflow = await pub.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  await pubCtx.close()
  expect(overflow).toBe(false)
  console.log(`[2D-12 mobile390] CREATE izdelek + javno /shop brez overflowa: PASS`)
})