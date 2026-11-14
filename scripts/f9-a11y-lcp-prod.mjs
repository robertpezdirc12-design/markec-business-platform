// ============================================================
// TOČKA 9 — kakovost javnih strani: a11y (axe, WCAG 2.0/2.1 AA)
// in LCP (mobilna emulacija, Fast-3G + 4× CPU throttle).
//
// Meri PRODUKCIJO (https://rcbeautysalon-phi.vercel.app) — javne
// strani: platforma + published najemniki. Izpis: per page
// kršitve axe (po resnosti) in LCP v sekundah (meja: < 2,5 s).
//
// Zagon:
//   node scripts/f9-a11y-lcp-prod.mjs
// ============================================================

import { chromium } from "@playwright/test"
import { readFileSync } from "node:fs"
import path from "node:path"

const BASE = process.env.PROD_BASE || "https://rcbeautysalon-phi.vercel.app"
const PAGES = process.env.PROD_PAGES
  ? process.env.PROD_PAGES.split(",")
  : ["/", "/pricing", "/s/studio-nika", "/s/nail-studio-luna/shop"]

const axeSource = readFileSync(
  path.resolve("node_modules/axe-core/axe.min.js"),
  "utf8"
)

const IMPACT_ORDER = { critical: 0, serious: 1, moderate: 2, minor: 3 }

// ------------------------------------------------------------
// 1) A11Y — axe.run (WCAG 2.0 A + 2.1 AA), namizni pogled.
// ------------------------------------------------------------
console.log("=== A11Y (axe, wcag2a+wcag2aa, namizni 1280×720) ===")
{
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  let criticalTotal = 0
  let seriousTotal = 0

  for (const route of PAGES) {
    const page = await ctx.newPage()
    try {
      await page.goto(BASE + route, { waitUntil: "load", timeout: 60000 })
      await page.addScriptTag({ content: axeSource })
      const res = await page.evaluate(
        () => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } })
      )
      const violations = res.violations
        .sort((a, b) => (IMPACT_ORDER[a.impact] ?? 9) - (IMPACT_ORDER[b.impact] ?? 9))
      const crit = violations.filter((v) => v.impact === "critical")
      const ser = violations.filter((v) => v.impact === "serious")
      criticalTotal += crit.reduce((n, v) => n + v.nodes.length, 0)
      seriousTotal += ser.reduce((n, v) => n + v.nodes.length, 0)
      console.log(`\n${route} — kršitve: ${violations.length} (critical: ${crit.length}, serious: ${ser.length})`)
      for (const v of violations.slice(0, 12)) {
        const sample = v.nodes[0]?.target?.join(" ") ?? ""
        console.log(`  [${v.impact ?? "?"}] ${v.id} ×${v.nodes.length} — ${v.help} | npr. ${sample.slice(0, 80)}`)
      }
    } catch (err) {
      console.log(`\n${route} — NAPAKA: ${String(err).slice(0, 200)}`)
    } finally {
      await page.close()
    }
  }
  console.log(`\nA11Y SKUPAJ: critical=${criticalTotal}, serious=${seriousTotal}`)
  await browser.close()
}

// ------------------------------------------------------------
// 2) LCP — mobilna emulacija (390×844, Fast 3G, 4× CPU), na svežem
//    kontekstu brez predpomnilnika (no cache) — Realni pogoji stranke.
// ------------------------------------------------------------
console.log("\n=== LCP (mobilna emulacija: 390×844, Fast 3G ~1.6 Mbps, 4× CPU) ===")
{
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  })
  let allPass = true

  for (const route of PAGES) {
    const page = await ctx.newPage()
    await page.addInitScript(() => {
      window.__lcp = 0
      try {
        const po = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) window.__lcp = e.startTime
        })
        po.observe({ type: "largest-contentful-paint", buffered: true })
      } catch {}
    })
    try {
      const cdp = await ctx.newCDPSession(page)
      await cdp.send("Network.enable")
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      })
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })

      const t0 = Date.now()
      await page.goto(BASE + route, { waitUntil: "load", timeout: 90000 })
      await page.waitForTimeout(1500) // naj LCP nalov zadnje kandidate
      const lcpMs = await page.evaluate(() => window.__lcp ?? 0)
      const secs = lcpMs / 1000
      const pass = secs > 0 && secs < 2.5
      if (!pass) allPass = false
      console.log(`${route} — LCP: ${secs.toFixed(2)} s ${pass ? "✓ (<2,5 s)" : "✗"} (load: ${((Date.now() - t0) / 1000).toFixed(1)} s)`)
    } catch (err) {
      allPass = false
      console.log(`${route} — NAPAKA: ${String(err).slice(0, 200)}`)
    } finally {
      await page.close()
    }
  }
  console.log(`\nLCP SKUPAJ: ${allPass ? "vse strani < 2,5 s ✓" : "vsaj ena strani presega 2,5 s ✗"}`)
  await browser.close()
}
