// F7.1 K2 mobile check (390px): dejavnost je vidna v headerju tudi na mobilnem.
// Uporabnik: cb@f631.test (izolirana f631 baza, dev 3013).
import { chromium } from "@playwright/test"

const BASE = process.env.PROJECT_URL || "http://localhost:3013"
const EMAIL = "cb@f631.test"
const PASS = "TestPass123!"

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/e-pošta/i).fill(EMAIL)
  await page.getByLabel(/geslo/i).fill(PASS)
  await page.getByRole("button", { name: /prijava/i }).click()
  await page.waitForURL(/dashboard/)
  await page.waitForTimeout(1200)
  const headerText = await page.locator("header").innerText().catch(() => "")
  const hasOrg = headerText.includes("Čebelarstvo Test")
  const hasVertical = headerText.includes("Čebelarstvo")
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  console.log(
    JSON.stringify({
      url: page.url(),
      headerHasOrg: hasOrg,
      headerHasVertical: hasVertical,
      horizontalOverflow: overflow,
    })
  )
  await browser.close()
})().catch((e) => {
  console.error("ERR", e.message)
  process.exit(1)
})