// F2.2.1 TEMP — wait until dev server is ready on a port. Delete after run.
// Usage: node scripts/_f221-portcheck.cjs [port]
const port = Number(process.argv[2] || 3001)
;(async () => {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/login`, { redirect: "manual" })
      console.log("READY_HTTP", r.status)
      process.exit(0)
    } catch {}
    await new Promise((r) => setTimeout(r, 2000))
  }
  console.log("NOT_READY")
  process.exit(1)
})()
