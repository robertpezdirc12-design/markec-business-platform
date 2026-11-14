// Faza 1 — CRUD smoke: čebelar doda "Panjska postaja" record, preveri da se shrani.
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
  await page.waitForTimeout(1400)
  // odpri tab Panjska postaja
  const tab = page.getByRole("tab").filter({ hasText: /Panjska postaja/ }).first()
  await tab.click()
  await page.waitForTimeout(800)
  // gumb za dodajanje (Dodaj / Novi / + )
  let added = null
  let addBtn = page.getByRole("button", { name: /^dodaj/i }).first()
  if (!(await addBtn.count().catch(() => 0))) {
    addBtn = page.getByRole("button").filter({ hasText: /dodaj/i }).first()
  }
  await addBtn.click().catch(() => {})
  await page.waitForTimeout(700)
  // izpolni ""Naziv postaje"" (prvo vnosno polje)
  const nameInput = page.locator("input").first()
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill("Prtava")
  }
  // shrani: gumb Shrani / Potrdi
  const save =
    page.getByRole("button", { name: /shrani/i }).first() ||
    page.getByRole("button").filter({ hasText: /shrani/i }).first()
  await save.click().catch(() => {})
  await page.waitForTimeout(1200)
  added = (await page.locator("body").innerText()).includes("Prtava")
  console.log(JSON.stringify({ added, url: page.url() }))
  await browser.close()
})().catch((e) => {
  console.error("ERR", e.message)
  process.exit(1)
})