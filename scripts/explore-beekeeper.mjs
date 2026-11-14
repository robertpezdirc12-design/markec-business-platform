// ČEBELAR RAZISKAVA — prijava + prehod skozi glavne poti, console errors, screenshoti.
import { chromium } from "@playwright/test"

const BASE = process.env.PROJECT_URL || "http://localhost:3021"
const OUT = "scripts/explore-shots"

;(async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  const consoleErrs = []
  const pageErrs = []
  page.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text().slice(0, 200)) })
  page.on("pageerror", (e) => pageErrs.push(String(e).slice(0, 200)))

  const report = {}
  const fs = await import("node:fs")
  fs.mkdirSync(OUT, { recursive: true })

  await page.goto(`${BASE}/login`)
  await page.waitForTimeout(1200)
  await page.getByLabel(/e-po?[sš]ta/i).fill("cb@f631.test")
  await page.getByLabel(/geslo/i).fill("TestPass123!")
  await page.getByRole("button", { name: /prijava/i }).click()
  await page.waitForURL(/dashboard/, { timeout: 40000 }).catch(()=>{})
  await page.waitForTimeout(2500)

  const routes = [
    ["dashboard", "/dashboard"],
    ["records", "/dashboard/records"],
    ["shop", "/dashboard/shop"],
    ["orders", "/dashboard/orders"],
    ["customers", "/dashboard/customers"],
    ["products", "/dashboard/products"],
    ["inventory", "/dashboard/inventory"],
    ["website", "/dashboard/website"],
    ["settings", "/dashboard/settings"],
  ]
  for (const [name, path] of routes) {
    try {
      await page.goto(`${BASE}${path}`)
      await page.waitForTimeout(1800)
      const title = await page.title().catch(()=>"")
      let h1 = ""
      try { h1 = (await page.locator("h1, h2").first().innerText()).slice(0, 80) } catch { h1 = "" }
      let nav = []
      try { nav = await page.locator("header nav a, aside a, nav a").allInnerTexts() } catch {}
      report[name] = { h1, navSample: nav.slice(0, 12) }
      await page.screenshot({ path: `${OUT}/${name}.png` }).catch(()=>{})
    } catch {
      report[name] = { h1: "ERR" }
    }
  }

  console.error("CONSOLE_ERRORS", JSON.stringify(consoleErrs.slice(0, 40), null, 2))
  console.error("PAGE_ERRORS", JSON.stringify(pageErrs.slice(0, 20), null, 2))
  console.log(JSON.stringify(report, null, 2))
  await browser.close()
})().catch((e) => { console.error("FATAL", e.message); process.exit(1) })