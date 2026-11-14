// F7.2 S11 — sanity: dejavnostne povezave odprejo realne route (ne 404/mrtvo).
import { chromium } from "@playwright/test"

const BASE = process.env.PROJECT_URL || "http://localhost:3013"
const PASS = "TestPass123!"

async function login(page, email) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/e-pošta/i).fill(email)
  await page.getByLabel(/geslo/i).fill(PASS)
  await page.getByRole("button", { name: /prijava/i }).click()
  await page.waitForURL(/dashboard/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1500)
}

;(async () => {
  const browser = await chromium.launch()
  const out = []
  // mehanik: Delovni nalogi (work-orders)
  {
    const page = await browser.newPage()
    await login(page, "mk@f631.test")
    const workOrders = page.getByRole("link", { name: /delovn/i }).first()
    const href = (await workOrders.getAttribute("href").catch(() => null)) || ""
    await page.goto(`${BASE}${href}`).catch(() => {})
    await page.waitForTimeout(1200)
    const status = await page.evaluate(() => document.body.innerText.length)
    out.push({ user: "mehanik", route: href, len: status })
    await page.close()
  }
  // cebelar: Evidence (records)
  {
    const page = await browser.newPage()
    await login(page, "cb@f631.test")
    const records = page.getByRole("link", { name: /evidence/i }).first()
    const href = (await records.getAttribute("href").catch(() => null)) || ""
    await page.goto(`${BASE}${href}`).catch(() => {})
    await page.waitForTimeout(1200)
    const len = await page.evaluate(() => document.body.innerText.length)
    out.push({ user: "cebelar", route: href, len })
    await page.close()
  }
  await browser.close()
  console.log(JSON.stringify(out, null, 2))
})().catch((e) => {
  console.error("ERR", e.message)
  process.exit(1)
})