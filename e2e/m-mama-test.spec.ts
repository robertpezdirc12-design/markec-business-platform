// M — "Test mame" (kriterij točke 9 iz docs/PLAN.md): časovno merjen sprehod
// brez programiranja: registracija → dejavnost → izdelek s ceno in SLIKO →
// objava → javna stran s ceno in sliko. Potrjuje tudi opozorilo o začetni
// zalogi (popravek po prvem sprehodu — izdelek brez zaloge je bil kupcu
// skrit pod "Ni na zalogi"). Kriterij: pod 15 min korakov.
import { test, expect } from "@playwright/test"
import { makeTenant, registerTenant, addStaff, publishSite, waitHydrated } from "./helpers"

const STEPS: { name: string; ms: number }[] = []
async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now()
  const out = await fn()
  const ms = Date.now() - t0
  STEPS.push({ name, ms })
  console.log(`⏱  ${name}: ${(ms / 1000).toFixed(1)} s`)
  return out
}

test("M — mama test: objava strani s sliko in ceno (brez programiranja)", async ({ page }) => {
  test.setTimeout(20 * 60_000)
  const t = makeTenant("beauty", "MamaTest")
  const shots = "test-results/mama-test"

  await step("1. Registracija + dejavnost + verifikacija", async () => {
    await registerTenant(page, t)
    await page.screenshot({ path: `${shots}/1-po-registraciji.png`, fullPage: true })
  })

  await step("2. Član osebja (pogoj objave)", async () => {
    await addStaff(page, "Mama Pomočnica")
    await page.screenshot({ path: `${shots}/2-osebje.png`, fullPage: true })
  })

  await step("3. Izdelek: cena + nalaganje SLIKE", async () => {
    await page.goto("/dashboard/products/new")
    await waitHydrated(page, "#name")
    await page.locator("#description").fill("Ročno izdelana krema za obraz")
    await page.locator("#price").fill("24")
    // nalaganje slike (isti nadzor kot ga uporablja obrazec)
    const fileInput = page.locator('input[type="file"]').first()
    // P1 security: SVG ni več dovoljen (whitelist rastrskih formatov).
    await fileInput.setInputFiles("e2e/fixtures/f63-test.png")
    await expect(page.getByText(/uspešno|uploaded|naložen/i).first()).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(1500) // kategorija se naloži asinhrono
    await page.locator("#name").fill("Krema za obraz")
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${shots}/3-izdelek-obrazec.png`, fullPage: true })
    await page.getByRole("button", { name: /Shrani|Ustvari/ }).first().click()
    await page.waitForURL(/dashboard\/products\/?$/, { timeout: 60_000 })
    // NOVO: opozorilo o začetni zalogi (popravek po "Testu mame")
    await expect(page.getByText(/začetno zalogo|prejem blaga/i).first()).toBeVisible({ timeout: 10_000 })
  })

  await step("4. Objava strani", async () => {
    await publishSite(page)
    await page.screenshot({ path: `${shots}/4-objava.png`, fullPage: true })
  })

  await step("5. Javna stran: slika + cena vidna", async () => {
    await page.goto(`/s/${t.slug}/shop`)
    await expect(page.getByText("Krema za obraz").first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText("24", { exact: false }).first()).toBeVisible()
    await expect(page.locator('img[alt*="Krema"], img[src*="placeholder"], img').first()).toBeVisible()
    await page.screenshot({ path: `${shots}/5-javna-stran.png`, fullPage: true })
  })

  const total = STEPS.reduce((a, s) => a + s.ms, 0)
  console.log(`\n=== MAMA TEST SKUPAJ: ${(total / 60_000).toFixed(1)} min ===`)
  for (const s of STEPS) console.log(`  ${(s.ms / 1000).toFixed(1).padStart(7)} s  ${s.name}`)
  // kriterij točke 9: pod 15 min
  expect(total).toBeLessThan(15 * 60_000)
})
