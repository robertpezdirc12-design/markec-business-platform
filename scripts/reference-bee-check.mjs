// Faza 1 (referenca čebelar) — potrdi, da /dashboard/records za čebelarja
// prikazuje nove čebelarske entity registre (bee-apiary ext).
import { chromium } from "@playwright/test"

const BASE = process.env.PROJECT_URL || "http://localhost:3014"

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/e-pošta/i).fill("cb@f631.test")
  await page.getByLabel(/geslo/i).fill("TestPass123!")
  await page.getByRole("button", { name: /prijava/i }).click()
  await page.waitForURL(/dashboard/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1200)
  await page.goto(`${BASE}/dashboard/records`)
  await page.waitForTimeout(1500)
  const text = await page.locator("body").innerText()
  const tabs = await page.locator("[role=tab]").allInnerTexts().catch(() => [])
  // izpišem entity tabe, ki jih vidi čebelar
  console.log(
    JSON.stringify({
      url: page.url(),
      title: await page.locator("h1").first().innerText().catch(() => ""),
      tabs: tabs.map((t) => t.trim()).filter(Boolean),
      hasPanjskaPostaja: text.includes("Panjska postaja"),
      hasPanj: text.includes("Panj"),
      hasPridelekMedu: text.includes("Pridelek medu"),
      hasZdravljenje: text.includes("Zdravljenje"),
    })
  )
  await browser.close()
})().catch((e) => {
  console.error("ERR", e.message)
  process.exit(1)
})