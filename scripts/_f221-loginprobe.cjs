// F2.2.1 TEMP — one-shot login diagnostic. Delete after run.
const { chromium } = require("@playwright/test")
;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ baseURL: "http://127.0.0.1:3001" })
  const page = await ctx.newPage()
  const lines = []
  page.on("console", (m) => lines.push("CONSOLE[" + m.type() + "] " + m.text().slice(0, 220)))
  page.on("pageerror", (e) => lines.push("PAGEERROR " + String(e.message).slice(0, 220)))
  page.on("requestfailed", (r) =>
    lines.push("REQFAIL " + r.method() + " " + r.url().slice(0, 120) + " " + (r.failure()?.errorText || ""))
  )
  page.on("response", (r) => {
    if (r.url().includes("auth") || r.request().method() !== "GET")
      lines.push("RESP " + r.request().method() + " " + r.status() + " " + r.url().slice(0, 120))
  })
  await page.goto("http://127.0.0.1:3001/login", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(
    () => Object.getOwnPropertyNames(document.body).some((k) => k.startsWith("__reactProps$")),
    null,
    { timeout: 60000 }
  )
  await page.locator("#email").fill("admin@f21.test")
  await page.locator("#password").fill("F21test!2026")
  await page.locator('button[type="submit"]').click()
  await page.waitForTimeout(8000)
  lines.push("FINAL_URL " + page.url())
  console.log(lines.join("\n"))
  await browser.close()
})()
