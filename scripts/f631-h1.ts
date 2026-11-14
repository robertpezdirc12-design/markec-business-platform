// F6.3.3 – preveri h1 javne strani tenanta.
import { get as httpGet } from "node:http"
const PORT = Number(process.env.PORT || 3009)
const HOST = "127.0.0.1"
const slug = process.env.SLUG || "frizer-test"

httpGet({ host: HOST, port: PORT, path: `/s/${slug}`, headers: { Host: `localhost:${PORT}` } }, (res) => {
  let d = ""
  res.on("data", (c) => (d += c))
  res.on("end", () => {
    const m = d.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
    const h1 = m ? String(m[1]).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "(no h1)"
    console.log("status=" + res.statusCode + " | slug=" + slug + " | h1=" + JSON.stringify(h1))
  })
}).on("error", (e) => console.log("ERR", e.message))