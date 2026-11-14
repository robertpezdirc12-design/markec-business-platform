// F7.2 — navigacijski check za 4 dejavnosti (f631, dev 3013).
// Izhod: za vsakega uporabnika JSON z naslovoma skupin A/B, linki skupine A, linki skupine B
// ter mobile no-overflow — za ročni pregled v poročilu.
import { chromium } from "@playwright/test"

const BASE = process.env.PROJECT_URL || "http://localhost:3013"
const PASS = "TestPass123!"
const USERS = [
  { label: "mehanik", email: "mk@f631.test", expectB: ["Storitve", "Izdelki", "Delovna naročila"] },
  { label: "cebelar", email: "cb@f631.test", expectB: ["Izdelki", "Kategorije", "Obrazci"] },
  { label: "frizer", email: "fr@f631.test", expectB: ["Termini", "Storitve", "Čakalna vrsta"] },
  { label: "sivilja", email: "si@f631.test", expectB: ["Delovna naročila", "Obrazci"] },
]

const COMMON = ["Nadzorna plošča", "Stranke", "Dokumenti", "Nastavitve"]

;(async () => {
  const browser = await chromium.launch()
  const out = []
  for (const u of USERS) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    await page.goto(`${BASE}/login`)
    await page.getByLabel(/e-pošta/i).fill(u.email)
    await page.getByLabel(/geslo/i).fill(PASS)
    await page.getByRole("button", { name: /prijava/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const asideText = (await page.locator("aside").innerText().catch(() => "")) || ""
    const links = await page
      .locator("aside a")
      .allInnerTexts()
      .catch(() => [])
    const groupTitles = await page
      .locator("aside p.text-\\[11px\\]")
      .allInnerTexts()
      .catch(() => [])
    const mobileOverflow = await (async () => {
      const m = await browser.newPage({ viewport: { width: 390, height: 844 } })
      await m.goto(`${BASE}/dashboard`)
      const overflow = await m.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      )
      await m.close()
      return overflow
    })()
    out.push({
      user: u.label,
      identity: asideText.split("\n").slice(0, 3).join(" | "),
      groupTitles,
      navLinks: links.map((l) => l.trim()).filter(Boolean),
      commonPresent: COMMON.filter((c) => links.some((l) => l.trim() === c)),
      expectB: u.expectB.map((eb) => ({ item: eb, present: links.some((l) => l.trim() === eb) })),
      mobile390Overflow: mobileOverflow,
      url: page.url(),
    })
    await page.close()
  }
  await browser.close()
  console.log(JSON.stringify(out, null, 2))
})().catch((e) => {
  console.error("ERR", e.message)
  process.exit(1)
})