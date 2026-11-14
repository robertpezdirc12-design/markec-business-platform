// F2.2.1 TEMP — probe chromium connectivity to dev server. Delete after run.
const { chromium } = require("@playwright/test")
;(async () => {
  const b = await chromium.launch({ headless: true })
  const ctx = await b.newContext()
  const page = await ctx.newPage()
  page.on("requestfailed", (r) => {
    const f = r.failure()
    console.log("REQFAILED", r.url().slice(0, 70), f ? f.errorText : "")
  })
  for (const url of [
    "http://localhost:3001/workspaces/manage",
    "http://127.0.0.1:3001/workspaces/manage",
    "http://127.0.0.1:3001/workspaces/manage",
    "http://localhost:3001/workspaces",
  ]) {
    try {
      const r = await page.goto(url, { timeout: 30000, waitUntil: "commit" })
      console.log("CHROME", url, "-> HTTP", r && r.status())
    } catch (e) {
      console.log("CHROME", url, "-> ERR", String(e.message).split("\n")[0])
    }
  }
  await b.close()
})()
