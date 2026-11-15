import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import {
  createProduct,
  makeTenant,
  publishSite,
  registerTenant,
  visitPublished,
  waitHydrated,
} from "./helpers"

// ============================================================
// EN PURCHASE FLOW (plan točka 8 — "Angleški uporabnik opravi nakup
// brez ene slovenske besede"): register tenant → publish → guest
// switches the public site to English (rc_admin_locale cookie) and
// buys a product shop → cart → checkout, without ever seeing
// Slovenian UI copy. The order is placed offline (no Stripe in the
// E2E environment) exactly like the golden-order flow.
// ============================================================

const e2eDb = new PrismaClient({
  datasources: { db: { url: process.env.E2E_DATABASE_URL ?? "" } },
})
test.afterAll(async () => {
  await e2eDb.$disconnect()
})

// Slovenian UI copy that must NEVER render on the English purchase path
// (platform strings — all dict-driven after the i18n footer/shop fixes).
const SL_MARKERS =
  /Dodaj v košarico|Zaključi nakup|Številka naročila|Hvala za naročilo|Nakupovalna košarica|Vaša košarica|Izdelki v košarici|Ime in priimek|Povzetek naročila|Vnesite|Nadaljuj z nakupovanjem|Izprazni košarico|Vaši kontaktni podatki|Dostavni naslov|Iskanje izdelkov|Hitre povezave|Delovni čas|Zaprto|Zasebnost|Pogoji uporabe|Piškotki|Spletna stran|Oblikovano|Kontaktne informacije|Rezervirajte online|Moji termini|Nalaganje/

// Tenant SAMPLE CONTENT (defaultSiteContent presets) is the tenant's own
// copy, editable in the site editor — not platform UI. Its known sample
// lines are stripped before the Slovenian check.
const TENANT_SAMPLE_CONTENT = [/^Ponudba, ki jo delite/, /^Stopite v svet/]

async function expectEnglish(page: import("@playwright/test").Page) {
  const lines = (await page.locator("body").innerText())
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !TENANT_SAMPLE_CONTENT.some((re) => re.test(l)))
  expect(
    lines.join("\n"),
    "English pages must not contain Slovenian platform UI copy"
  ).not.toMatch(SL_MARKERS)
}

test("H — EN purchase: shop → cart → checkout without a single Slovenian word", async ({
  page,
  browser,
}) => {
  const t = makeTenant("beauty", "EN Shop")
  const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3123"

  // ---- owner: register tenant, add a product, publish ----
  await registerTenant(page, t)
  await expect(page).toHaveURL(/dashboard/)
  await createProduct(page, `EN test serum ${t.slug}`)
  await publishSite(page)

  // ---- guest: English locale from the first byte (server reads the
  //      rc_admin_locale cookie on SSR — no flash of Slovenian) ----
  const ctx = await browser.newContext()
  await ctx.addCookies([
    { name: "rc_admin_locale", value: "en", url: baseUrl },
  ])
  const g = await ctx.newPage()

  // ---- shop: English product listing ----
  await visitPublished(g, `${baseUrl}/s/${t.slug}/shop`, /serum/i)
  await expect(
    g.getByRole("button", { name: "Add to cart" }).first()
  ).toBeVisible({ timeout: 20_000 })
  await expectEnglish(g)
  await g.getByRole("button", { name: "Add to cart" }).first().click()

  // ---- cart: English form, no Slovenian ----
  await g.goto(`${baseUrl}/s/${t.slug}/cart`)
  await waitHydrated(g, "#guest-name")
  await expect(g.getByText("Shopping cart")).toBeVisible({ timeout: 20_000 })
  await expect(g.getByText("Full name *")).toBeVisible()
  await expect(g.getByRole("button", { name: "Checkout" })).toBeVisible()
  await expectEnglish(g)

  const guestName = `Emma Stone ${Date.now().toString(36)}`
  const guestEmail = `emma.stone.${Date.now().toString(36)}@example.com`
  await g.locator("#guest-name").fill(guestName)
  await g.locator("#guest-email").fill(guestEmail)

  // ---- checkout (offline order — same path the golden-order uses) ----
  await g.getByRole("button", { name: "Checkout" }).click()
  await expect(g.locator("body")).toContainText("Thank you for your order!", {
    timeout: 30_000,
  })
  await expect(g.locator("body")).toContainText("Order number")
  await expectEnglish(g)

  const orderNumber = (await g.locator("body").innerText()).match(
    /Order number\s*\n\s*([A-Z0-9]{6,12})/
  )?.[1]
  expect(orderNumber, "confirmation must show an order number").toBeTruthy()

  await ctx.close()

  // ---- DB truth: the English guest order is persisted ----
  const org = await e2eDb.organization.findUniqueOrThrow({
    where: { slug: t.slug },
  })
  const order = await e2eDb.order.findFirstOrThrow({
    where: { organizationId: org.id, guestName },
  })
  expect(order.guestEmail).toBe(guestEmail)
  expect(order.customerId).toBeNull()
})
