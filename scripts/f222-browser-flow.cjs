// ============================================================
// F2.2.2 — BROWSER FLOW (Playwright + real NextAuth + markec_dev)
//
//   Prereq: dev server on :3000 with DATABASE_URL=...markec_dev
//   Run:
//     $env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/markec_dev"
//     node scripts/f222-browser-flow.cjs
//
// Proverja F2.2.2 popravke proti živemu serverju:
//   A) prijava admin@rcbeautysalon.org + sweep 22 admin strani
//      (+ dinamične detail strani, kjer seed da razreši) — lovimo
//      konzolne/RSC napake (Decimal, NaN, hydration, 5xx)
//   B) gostova rezervacija na /s/demo-salon/booking (Stripe absent
//      → PENDING fallback): push mora pasti NAZAJ na tenant
//      /s/demo-salon/booking/success?appointment=..., osvežitev in
//      direkten obisk delujeta, IDOR guard javlja "ni bila najdena",
//      neznana org se odbije
//   C) prijava cliente → telefon PREFILLED iz Customer profila
//      (+ jasno validacijsko sporočilo na slabo številko), uspešna
//      oddaja → /my-appointments?new=
//   D) viewport sweep 1440/768/390 za tenant home/booking/services
//
// Hard guard: DATABASE_URL mora biti markec_dev.
// ============================================================

const { chromium } = require("@playwright/test")
const { PrismaClient } = require("@prisma/client")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const BASE = "http://localhost:3000"
const ADMIN = "admin@rcbeautysalon.org"
const CLIENTE = "cliente@rcbeautysalon.org"
const ADMIN_PW = process.env.SEED_ADMIN_PASSWORD || "admin123"
const CLIENTE_PW = process.env.SEED_CLIENTE_PASSWORD || "cliente123"
const OUT_DIR = path.join(os.tmpdir(), "markec-f222")
const SHOTS = path.join(OUT_DIR, "shots")
const OUT = path.join(OUT_DIR, "results.json")

const dbUrl = process.env.DATABASE_URL || ""
if (!/^postgresql:\/\/[^@]*@[^/]+\/markec_dev(\?|$)/.test(dbUrl)) {
  console.error("REFUSED: DATABASE_URL must point to markec_dev")
  process.exit(1)
}
const prisma = new PrismaClient()

const results = []
function record(name, ok, detail) {
  const row = { name, ok: !!ok, detail: String(detail ?? "").slice(0, 400) }
  results.push(row)
  console.log(`${ok ? "PASS" : "FAIL"} | ${name} | ${row.detail.slice(0, 220)}`)
}

async function waitHydrated(page) {
  await page.waitForFunction(
    () =>
      Object.getOwnPropertyNames(document.body).some((k) =>
        k.startsWith("__reactProps$")
      ),
    null,
    { timeout: 120000 }
  )
}

// Konzolni šum dev okolja — NE štejemo kot napako
const NOISE_RE =
  /^(Download the React DevTools|BatteryDebugger|\[Fast Refresh|Fast-refresh|Please update the following|The data in this module is over two months old)/i
// Suspekti F2.2.2: Decimal, Prisma, NaN, hydration, 5xx
const SUSPECT_RE =
  /Decimal|Prisma|NaN|hydrat|mismatch|Internal Server Error|application error|\[Build Error\]/i

const allErrors = [] // { page: currentURL, kind, level, text }

function attachCapture(page, label) {
  const onConsole = (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      allErrors.push({ page: label, kind: "console", level: msg.type(), text: msg.text() })
    }
  }
  const onPageError = (err) => {
    allErrors.push({ page: label, kind: "pageerror", level: "error", text: err.message })
  }
  const onResponse = (resp) => {
    if (resp.status() >= 500) {
      allErrors.push({ page: label, kind: "http", level: "error", text: `${resp.status()} ${resp.url()}` })
    }
  }
  page.on("console", onConsole)
  page.on("pageerror", onPageError)
  page.on("response", onResponse)
  return () => {
    page.off("console", onConsole)
    page.off("pageerror", onPageError)
    page.off("response", onResponse)
  }
}

function realErrorsOf(label, at) {
  const now = at || new Date().toISOString()
  return allErrors.filter(
    (e) =>
      e.page === label &&
      !e._reported &&
      !NOISE_RE.test(e.text) &&
      (e.kind === "pageerror" || e.kind === "http" || e.level === "error" || SUSPECT_RE.test(e.text))
  )
}

function markReported(entries) {
  entries.forEach((e) => (e._reported = true))
}

async function sweepPage(page, route, label, extraTexts = []) {
  const errors = []
  const detach = attachCapture(page, label)
  try {
    const resp = await page.goto(`${BASE}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    })
    await waitHydrated(page)
    const body = await page.locator("body").innerText()
    const status = resp ? resp.status() : 0
    const hasFatal =
      /Application error|Internal Server Error|This page could not be found|Something went wrong/i.test(
        body
      )
    const real = realErrorsOf(label)
    markReported(real)
    const ok = !hasFatal && body.trim().length > 120 && real.length === 0 && status < 400
    const extra = extraTexts.every((t) => body.includes(t))
    record(
      label,
      ok && extra,
      `status=${status} len=${body.length} realErr=${real.length}` +
        (real.length ? ` ERR:${real[0].text.slice(0, 150)}` : extra ? "" : " manjka_pričakovano_besedilo")
    )
    return ok && extra
  } catch (err) {
    record(label, false, `EXC ${err.message.slice(0, 180)}`)
    await page
      .screenshot({ path: path.join(SHOTS, `err-${label.replace(/[^\w]+/g, "_")}.png`) })
      .catch(() => {})
    return false
  } finally {
    detach()
  }
}

async function login(page, email, pw) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" })
  await waitHydrated(page)
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(pw)
  await page.locator('button[type="submit"]').click()
  await page.waitForFunction(
    () => !location.pathname.startsWith("/login"),
    null,
    { timeout: 120000 }
  )
  await waitHydrated(page)
}

;(async () => {
  fs.mkdirSync(SHOTS, { recursive: true })
  const suffix = Date.now().toString(36)

  // --- DB SHAPE ----------------------------------------------------------------
  const org = await prisma.organization.findUnique({
    where: { slug: "demo-salon" },
    select: { id: true, status: true, publishState: true },
  })
  record(
    "demo-salon PUBLISHED+ACTIVE",
    !!org && org.publishState === "PUBLISHED" && org.status === "ACTIVE",
    JSON.stringify(org)
  )
  const [firstAppt, firstOrder, firstProduct, firstService, firstStaff, firstUser] =
    await Promise.all([
      prisma.appointment.findFirst({
        where: { organizationId: org.id },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      }),
      prisma.order.findFirst({ where: { organizationId: org.id }, select: { id: true } }),
      prisma.product.findFirst({ where: { organizationId: org.id }, select: { id: true } }),
      prisma.service.findFirst({
        where: { organizationId: org.id },
        select: { id: true, slug: true, name: true },
      }),
      prisma.staff.findFirst({
        where: { organizationId: org.id },
        select: { id: true, name: true },
      }),
      prisma.user.findFirst({ where: { organizationId: org.id }, select: { id: true } }),
    ])
  const guestEmail = `f222-guest-${suffix}@test.dev`
  const guestPhone = "+386 31 222 999"

  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } })
  ctx.setDefaultTimeout(120000)
  ctx.setDefaultNavigationTimeout(120000)
  const page = await ctx.newPage()

  // dnevniška labela: prijavimo katera faza je trenutno na obrazcu
  let phaseLabel = "init"

  try {
    // ==========================================================
    // A) ADMIN SWEEP — 22 statičnih + dinamične strani
    // ==========================================================
    phaseLabel = "A-admin"
    const detachA = attachCapture(page, phaseLabel)
    await login(page, ADMIN, ADMIN_PW)
    record("A0 prijava admin", page.url().includes("/dashboard"), page.url())

    const staticRoutes = [
      "/dashboard",
      "/dashboard/analytics",
      "/dashboard/appointments",
      "/dashboard/appointments/new",
      "/dashboard/documents",
      "/dashboard/forms",
      "/dashboard/marketing",
      "/dashboard/orders",
      "/dashboard/packages",
      "/dashboard/products",
      "/dashboard/products/stocktake",
      "/dashboard/projects",
      "/dashboard/records",
      "/dashboard/roles",
      "/dashboard/services",
      "/dashboard/services/new",
      "/dashboard/settings",
      "/dashboard/staff",
      "/dashboard/staff/new",
      "/dashboard/users",
      "/dashboard/waitlist",
      "/dashboard/walk-in",
    ]
    let adminPasses = 0
    for (const r of staticRoutes) {
      const ok = await sweepPage(page, r, `A ${r}`)
      if (ok) adminPasses++
    }
    record(
      "A summary statičnih 22 strani",
      adminPasses === staticRoutes.length,
      `${adminPasses}/${staticRoutes.length} PASS`
    )

    // dinamične detail strani (kjer đồngovani seed podatek obstaja)
    const dynamicRoutes = [
      firstAppt && `/dashboard/appointments/${firstAppt.id}`,
      firstOrder && `/dashboard/orders/${firstOrder.id}`,
      firstProduct && `/dashboard/products/${firstProduct.id}/edit`,
      firstService && `/dashboard/services/${firstService.id}/edit`,
      firstStaff && `/dashboard/staff/${firstStaff.id}/edit`,
      firstUser && `/dashboard/users/${firstUser.id}`,
      firstUser && `/dashboard/users/${firstUser.id}/edit`,
    ].filter(Boolean)
    let dynPasses = 0
    for (const r of dynamicRoutes) {
      const ok = await sweepPage(page, r, `A ${r}`)
      if (ok) dynPasses++
    }
    record(
      "A summary dinamičnih strani",
      dynPasses === dynamicRoutes.length,
      `${dynPasses}/${dynamicRoutes.length} PASS (appt=${!!firstAppt} order=${!!firstOrder} prod=${!!firstProduct} svc=${!!firstService} staff=${!!firstStaff} user=${!!firstUser})`
    )
    detachA()

    // ==========================================================
    // B) GOSTOVA REZERVACIJA (no-payment fallback) + IDOR
    // ==========================================================
    phaseLabel = "B-guest-booking"
    const detachB = attachCapture(page, phaseLabel)

    await page.goto(`${BASE}/s/demo-salon/booking`, { waitUntil: "domcontentloaded" })
    await waitHydrated(page)
    await page.waitForSelector('a[href*="/booking?service="]', { timeout: 60000 })
    const svcLinks = await page.locator('a[href*="/booking?service="]').count()
    record("B0 tenant booking service picker", svcLinks >= 3, `links=${svcLinks}`)
    await page.screenshot({ path: path.join(SHOTS, "b0-service-picker.png") })

    // izberi prvo storitev
    await page.locator('a[href*="/booking?service="]').first().click()
    await page.waitForSelector("text=Izberite specialista", { timeout: 120000 })
    await waitHydrated(page)
    const onServiceForm = await page
      .locator("text=Izberite specialista")
      .first()
      .isVisible()
      .catch(() => false)
    record("B1 service-first booking form", onServiceForm, page.url())
    await page.screenshot({ path: path.join(SHOTS, "b1-service-form.png") })

    // izberi specialista (prvi gumb v osebnem gridu)
    const staffBtns = page.locator('div[class*="sm:grid-cols-2"] > button')
    const staffCount = await staffBtns.count()
    if (staffCount > 0) {
      await staffBtns.first().click()
      await page.waitForTimeout(400)
      const pressed = await page
        .locator('div[class*="sm:grid-cols-2"] > button[aria-pressed="true"]')
        .count()
      record("B2 specialist izbran", pressed > 0, `staff options=${staffCount}`)
    } else {
      record("B2 specialist izbran", false, "ni osebnostnih gumbov")
    }

    // izberi datum (Nov delovniki) + uro; dan po dan dokler ne pade slot
    const dayAttempts = [10, 11, 12, 13, 16, 17, 18, 19]
    let slotPicked = false
    for (const day of dayAttempts) {
      const cell = page
        .locator('table button:not([class*="day-outside"])')
        .filter({ hasText: new RegExp(`^${day}\\.?$`) })
      if ((await cell.count()) === 0) continue
      await cell.first().click()
      // poišč katere koli omogočene slot gumbe
      const slotSel = page
        .locator('button[class*="tabular-nums"]:not([disabled])')
        .filter({ hasText: /^\d{1,2}[.:]\d{2}$/ })
      try {
        await page.waitForFunction(
          () =>
            document.querySelectorAll('button[class*="tabular-nums"]:not([disabled])').length > 0,
          null,
          { timeout: 8000 }
        )
      } catch {
        continue // brez slotov — naslednji dan
      }
      const slotN = await page
        .locator('button[class*="tabular-nums"]:not([disabled])')
        .filter({ hasText: /^\d{1,2}[.:]\d{2}$/ })
        .count()
      if (slotN === 0) continue
      await slotSel.first().click()
      await page.waitForTimeout(500)
      const chosen = await page
        .locator('button[class*="tabular-nums"][aria-pressed="true"]')
        .count()
      if (chosen === 0) continue

      // izpolni podatke gosta
      await page.locator("#firstName").fill("Marko")
      await page.locator("#lastName").fill("Testnik")
      await page.locator("#email").fill(guestEmail)
      await page.locator("#phone").fill(guestPhone)
      slotPicked = true
      record("B3 termin izbran + podatki", true, `day=${day} slots=${slotN}`)
      await page.screenshot({ path: path.join(SHOTS, "b3-form-filled.png") })
      await page.locator('form button[type="submit"]').first().click()
      try {
        await page.waitForFunction(
          () =>
            location.pathname.includes("/booking/success") &&
            location.search.includes("appointment="),
          null,
          { timeout: 60000 }
        )
        break
      } catch {
        // zgrešili klic — vinjetta? shortTimeout soft — BREZ — vrni error text + ponovi dan
        const bodyT = await page.locator("body").innerText()
        if (bodyT.includes("Rezervacija oddana")) break
      }
    }
    if (!slotPicked) record("B3 termin izbran", false, "datum+ura nista rezervirana po 8 dnevih")

    // kot punktured success detail
    const finalUrl = page.url()
    const redirectOk = /\/s\/demo-salon\/booking\/success\?appointment=[A-Za-z0-9]+$/.test(
      finalUrl.split("#")[0]
    )
    record(
      "B4 redirect pade na TENANTA (P0-2)",
      redirectOk,
      finalUrl
    )

    const dbAppt = await prisma.appointment.findFirst({
      where: { guestEmail, organizationId: org.id },
      select: { id: true, status: true, startTime: true, totalPrice: true },
    })
    record(
      "B5 DB: gostova rezervacija PENDING @ demo org",
      !!dbAppt && dbAppt.status === "PENDING",
      dbAppt ? JSON.stringify(dbAppt) : "se V BAZI NI"
    )

    // osvežitev: uspeh ostane
    await page.reload({ waitUntil: "domcontentloaded" })
    await waitHydrated(page)
    await page.waitForTimeout(800)
    const refreshed = await page.locator("body").innerText()
    record(
      "B6 refresh ohrani success",
      refreshed.includes("Rezervacija oddana!") && !refreshed.includes("ni bila najdena"),
      refreshed.slice(0, 130)
    )
    await page.screenshot({ path: path.join(SHOTS, "b6-refresh.png") })

    // direkten obist visit same URL (nov page)
    if (dbAppt) {
      await page.goto(
        `${BASE}/s/demo-salon/booking/success?appointment=${dbAppt.id}`,
        { waitUntil: "domcontentloaded" }
      )
      await waitHydrated(page)
      await page.waitForTimeout(800)
      const directText = await page.locator("body").innerText()
      record(
        "B7 direkten obist istega URL",
        directText.includes("Rezervacija oddana!") && !directText.includes("ni bila najdena"),
        directText.slice(0, 130)
      )
      await page.screenshot({ path: path.join(SHOTS, "b7-direct.png") })
    }

    // IDOR guard: fake id na isti org
    await page.goto(`${BASE}/s/demo-salon/booking/success?appointment=cuidfake123456`, {
      waitUntil: "domcontentloaded",
    })
    await waitHydrated(page)
    await page.waitForTimeout(500)
    const idorText = await page.locator("body").innerText()
    record(
      "B8 IDOR guard (fake id, isti org)",
      idorText.includes("ni bila najdena"),
      idorText.slice(0, 120)
    )

    // neznana org — proxy odbije
    await page.goto(`${BASE}/s/neznana-org-xyz/booking/success?appointment=x`, {
      waitUntil: "domcontentloaded",
    })
    await page.waitForTimeout(1500)
    record(
      "B9 neznana /s/ slug odbita",
      !page.url().includes("/s/neznana-org-xyz"),
      page.url()
    )
    detachB()

    // ==========================================================
    // C) PRIJAVLJENA STRANKA — telefon prefill + validacija + oddaja
    // ==========================================================
    phaseLabel = "C-cliente"
    const detachC = attachCapture(page, phaseLabel)
    await login(page, CLIENTE, CLIENTE_PW)
    record("C0 prijava cliente", !page.url().startsWith(`${BASE}/login`), page.url())

    await page.goto(`${BASE}/s/demo-salon/booking?service=${firstService.slug}`, {
      waitUntil: "domcontentloaded",
    })
    await waitHydrated(page)
    await page.waitForSelector("#phone", { timeout: 60000 })
    await page.waitForTimeout(700)
    const phoneVal = await page.locator("#phone").inputValue()
    record(
      "C1 telefon PREFILL (P1-4)",
      phoneVal === "+386 40 200 202",
      `input="${phoneVal}"`
    )
    await page.screenshot({ path: path.join(SHOTS, "c1-prefill.png") })

    // slaba številka → jasno sporočilo
    await page.locator("#phone").fill("12")
    await page.waitForTimeout(400)
    await page.locator('form button[type="submit"]').first().click()
    await page.waitForTimeout(1800)
    const afterBad = await page.locator("body").innerText()
    record(
      "C2 jasno validacijsko sporočilo za telefon",
      afterBad.includes("vsaj 8") || afterBad.includes("veljavno telefonsko"),
      (afterBad.match(/[^\n]*(vsaj 8 števk|veljavno telefonsko)[^\n]*/) || [afterBad.slice(0, 130)])[0]
    )
    await page.screenshot({ path: path.join(SHOTS, "c2-phone-error.png") })

    // popravi številko + termin + oddaja → /my-appointments?new=
    let clienteBooked = false
    for (const day of dayAttempts) {
      const cell = page
        .locator('table button:not([class*="day-outside"])')
        .filter({ hasText: new RegExp(`^${day}\\.?$`) })
      if ((await cell.count()) === 0) continue
      await cell.first().click()
      try {
        await page.waitForFunction(
          () =>
            document.querySelectorAll('button[class*="tabular-nums"]:not([disabled])').length > 0,
          null,
          { timeout: 8000 }
        )
      } catch {
        continue
      }
      await page
        .locator('button[class*="tabular-nums"]:not([disabled])')
        .filter({ hasText: /^\d{1,2}[.:]\d{2}$/ })
        .first()
        .click()
      await page.waitForTimeout(400)
      await page.locator("#phone").fill("+386 40 200 202")
      await page.locator('form button[type="submit"]').first().click()
      try {
        await page.waitForFunction(
          () =>
            location.pathname.startsWith("/my-appointments") && location.search.includes("new="),
          null,
          { timeout: 60000 }
        )
        clienteBooked = true
        break
      } catch {
        const t = await page.locator("body").innerText()
        if (t.includes("/my-appointments") || page.url().includes("/my-appointments")) {
          clienteBooked = true
          break
        }
        continue
      }
    }
    record(
      "C3 oddaja prijavljene stranke",
      clienteBooked,
      page.url()
    )
    await page.screenshot({ path: path.join(SHOTS, "c3-my-appointments.png") })
    detachC()

    // ==========================================================
    // D) VIEWPORT SWEEP (1440/768/390) — tenant + booking + services
    // ==========================================================
    phaseLabel = "D-viewport"
    for (const [w, h, vpName] of [
      [1440, 900, "1440"],
      [768, 1024, "768"],
      [390, 844, "390"],
    ]) {
      const vp = await browser.newContext({ baseURL: BASE, viewport: { width: w, height: h } })
      vp.setDefaultTimeout(120000)
      vp.setDefaultNavigationTimeout(120000)
      const vpage = await vp.newPage()
      const detachD = attachCapture(vpage, `D vp${vpName}`)
      let vpAll = true
      for (const r of ["/s/demo-salon", "/s/demo-salon/booking", "/s/demo-salon/services"]) {
        try {
          await vpage.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded", timeout: 120000 })
          await waitHydrated(vpage)
          const body = await vpage.locator("body").innerText()
          const real = realErrorsOf(`D vp${vpName}`).filter((e) => !/favicon/i.test(e.text))
          markReported(real)
          record(
            `D vp${vpName} ${r}`,
            real.length === 0,
            real.length ? `ERR:${real[0].text.slice(0, 150)}` : `len=${body.length}`
          )
          if (real.length) vpAll = false
          await vpage.screenshot({
            path: path.join(SHOTS, `d${vpName}-${r.replaceAll("/", "_")}.png`),
          })
        } catch (e) {
          vpAll = false
          record(`D vp${vpName} ${r}`, false, `EXC ${e.message.slice(0, 110)}`)
        }
      }
      detachD()
      record(`D viewport ${vpName} sweep`, vpAll, vpAll ? "3 tenant strani OK" : "napake na straneh")
      await vpage.close()
      await vp.close()
    }
  } catch (err) {
    record("NEPRIČAKOVANA NAPAKA", false, err.message)
    await page.screenshot({ path: path.join(SHOTS, "error.png") }).catch(() => {})
  } finally {
    fs.writeFileSync(OUT, JSON.stringify({ allErrors, results }, null, 2))
    await browser.close()
    await prisma.$disconnect()
  }

  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} PASS → ${OUT}`)
  process.exit(failed ? 1 : 0)
})()
