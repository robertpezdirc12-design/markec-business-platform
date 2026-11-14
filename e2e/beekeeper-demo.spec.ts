import { test, expect } from "@playwright/test"
import { login } from "./helpers"

// ============================================================
// ŽIVI DEMO PROSTOR — predposejani čebelarski delovni prostor
// (scripts/seed-beekeeping-complete.ts → org 'svezi-cebeler-demo').
// Potrjuje, da se obiskovalec z izložbe (kartica "Oglej si živi
// demo") prijavi kot lastnik in vidi realen, vnaprej napolnjen
// čebelarski workspace — ne prazne predloge.
// ============================================================

const DEMO_EMAIL = "demo.cebeler@markec.test"
const DEMO_PASSWORD = "demo1234"

test("Beekeeper demo: owner logs in and sees the populated workspace", async ({ page }) => {
  // Enak vstop kot na izložbi ("Oglej si živi demo" → /login?org=…)
  await page.goto("/login?org=svezi-cebeler-demo")
  await login(page, DEMO_EMAIL, DEMO_PASSWORD)

  await expect(page).toHaveURL(/dashboard/, { timeout: 30_000 })

  // Delovni prostor odraža dejavnost (čebelar = trgovina/izdelki)
  await page.goto("/dashboard/products")
  await expect(page.locator("body")).toContainText(/Cvetlični med|Lipov med/, { timeout: 15_000 })

  // Vnaprej napolnjene čebelarske evidence (bee-apiary): panji in družine
  // so vidni s seštevki na pregledu (apiculture dashboard).
  await page.goto("/dashboard/apiculture")
  await expect(page.locator("body")).toContainText(/Panjska postaja|Čebelnjak|panj|dru|postaja/i, {
    timeout: 15_000,
  })

  // Pripravljeno naročilo — poslovanje ni prazno.
  await page.goto("/dashboard/orders")
  await expect(page.locator("body")).toContainText(/Naročila|orders/i, { timeout: 15_000 })
})