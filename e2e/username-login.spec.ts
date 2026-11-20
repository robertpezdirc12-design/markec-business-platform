import { test, expect, type Page } from "@playwright/test"
import { waitHydrated } from "./helpers"

// ============================================================
// USERNAME LOGIN E2E (migrate 20261129120000_add_username)
//
// Poln, resnični UI tok brez mockov:
//   1. Registracija z uporabniškim imenom (pravi /register obrazec).
//   2. Potrditev e-pošte prek povezave, ki jo UI prikaže v testnem
//      okolju (Resend ni konfiguriran → registerUser vrne
//      verificationUrl in obrazec jo prikaže na "Skoraj končano").
//   3. Prijava z UPORABNIŠKIM IMENOM (ne e-pošto) — resolveLoginToEmail
//      razreši username → email → NextAuth credentials.
//   4. Odjava prek prave /logout strani.
//   5. Ponovna prijava z username v DRUGI VELIKOSTI ČRK — authorize
//      lowercasea vnos pred uniktnim iskanjem (shranjen je lowercase).
//
// Podatki so enkratni po zagonu (RUN), zato ponovni zagoni ne trčijo
// v unikatnost username/e-pošte na vztrajni testni bazi.
// ============================================================

const RUN = Date.now().toString(36)
const USER = {
  name: `E2e Username ${RUN}`,
  email: `e2e-username-${RUN}@example.com`,
  // Registracija validira [a-z0-9_] (male črke) — velika za test case-
  // insensitivity se uporabi le ob prijavi.
  username: `e2e_${RUN}`,
  password: "E2e-pass-1!",
}

/** Prijava prek pravega /login obrazca; čakamo na cilj po uspehu. */
async function realLogin(page: Page, login: string, password: string): Promise<void> {
  await page.goto("/login")
  await waitHydrated(page, "#login")
  await page.locator("#login").fill(login)
  await page.locator("#password").fill(password)
  await page.getByRole("button", { name: "Prijava" }).click()
  // /login uspeh → /self-service → (ensureSelfServiceWorkspace) → /dashboard*.
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 })
}

test.describe("username login (add_username migration)", () => {
  test("register with username → verify → login by username → re-login case-insensitive", async ({ page }) => {
    // 1) Registracija z uporabniškim imenom (pravi /register tok).
    await page.goto("/register")
    await waitHydrated(page, "#name")
    await page.locator("#name").fill(USER.name)
    await page.locator("#email").fill(USER.email)
    await page.locator("#username").fill(USER.username)
    await page.locator("#password").fill(USER.password)
    await page.locator("#confirmPassword").fill(USER.password)
    await page.getByRole("button", { name: "Ustvari račun" }).click()

    // 2) Testno okolje brez e-poštnega servisa: obrazec pokaže
    //    potrditveno povezavo neposredno ("Skoraj končano").
    await expect(page.getByText("Skoraj končano")).toBeVisible({ timeout: 30_000 })
    await page.getByRole("link", { name: "Potrdi račun zdaj" }).click()

    // 3) Prava /verify-email stran potrdi žeton.
    await expect(page.getByText("E-pošta potrjena!")).toBeVisible({ timeout: 30_000 })
    // Gumb je Button-as-Child okoli Link → dostopna vloga je "link".
    await page.getByRole("link", { name: "Prijava" }).click()
    await page.waitForURL(/\/login/, { timeout: 30_000 })

    // 4) PRIJAVA Z UPORABNIŠKIM IMENOM (ključni preizkus migracije).
    await realLogin(page, USER.username, USER.password)
    expect(page.url()).toContain("/dashboard")

    // 5) Odjava prek prave /logout strani (POST server action).
    await page.goto("/logout")
    await page.getByRole("button", { name: "Da, odjavi me" }).click()
    await page.waitForURL(/\/$/, { timeout: 30_000 })

    // 6) Ponovna prijava z VEČKO ČRFNO obliko username-a — resolveLoginToEmail
    //    lowercasea pred iskanjem; če bi authorize iskal raw vrednost, bi
    //    ta prijava padla (username je shranjen lowercase).
    await realLogin(page, USER.username.toUpperCase(), USER.password)
    expect(page.url()).toContain("/dashboard")

    console.log(`[username-login] e2e: PASS (username=${USER.username})`)
  })
})