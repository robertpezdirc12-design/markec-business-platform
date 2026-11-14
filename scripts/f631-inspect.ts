// F6.3.2 — dejanski prikaz MARKEC javnih strani (E2E).
// Direktno /s/{slug} na lokalni MARKEC (port iz env, default 3008).
// Izpiše: title, h1, hero struktura (split/minimal/centered), CTA href (najemniški),
// in prisotnost sekcij. Dokaže funkcionalno/strukturno razliko med dejavnostmi.
import { get as httpGet } from "node:http"

const PORT = Number(process.env.PORT || 3008)
const HOST = "127.0.0.1"

const TENANTS = [
  { slug: "mehanik-test", vert: "mehanik", expectName: "Avtomehanika" },
  { slug: "frizer-test", vert: "frizer", expectName: "Frizerski" },
  { slug: "sivilja-test", vert: "seamstress", expectName: "atelje" },
  { slug: "cebelar-test", vert: "beekeeping", expectName: "Čebelar" },
]

function getPage(s: string): Promise<string> {
  return new Promise((resolve, reject) => {
    httpGet({ host: HOST, port: PORT, path: `/s/${s}`, headers: { Host: `localhost:${PORT}` } }, (res) => {
      let b = ""
      res.on("data", (c) => (b += c))
      res.on("end", () => resolve(b))
    }).on("error", reject)
  })
}

const strip = (x: string) => x.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()

function heroVariant(body: string): string {
  const hero = body.slice(body.indexOf("<section"), body.indexOf("<section") + 2400)
  if (/lg:grid-cols-2/.test(hero) && /order-first/.test(body)) return "SPLIT"
  if (/max-w-3xl\s+text-center/.test(hero) && /bg-background/.test(hero)) return "MINIMAL"
  if (/bg-linear-to-br/.test(hero) || /HeroVideo/.test(body)) return "CENTERED"
  return "?"
}

function ctas(body: string): string[] {
  // Najemniški href-i so /s/{slug}/... — zajamemo zadnji segment.
  const hrefs = [...body.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
  const interesting = hrefs.filter((p) => /\/backing|\/inquiry|\/services|\/shop|\/cart|\/contact/.test(p))
  return [...new Set(interesting.map((p) => p.replace(/^\/s\/[^/]+/, "")))]
}

async function main() {
  console.log(`F6.3.2 MARKEC E2E — ${HOST}:${PORT} (pravi prikaz /s/{slug})\n`)
  for (const t of TENANTS) {
    const b = await getPage(t.slug)
    const title = strip((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "").slice(0, 70)
    const h1 = strip((b.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "").slice(0, 60)
    const hero = heroVariant(b)
    const cta = ctas(b)
    const sections = ["services", "team", "shop", "reviews"].filter((k) => new RegExp(`id="${k}"`).test(b))
    console.log(`• ${t.vert} (${t.slug})`)
    console.log(`   title=${JSON.stringify(title)}  h1=${JSON.stringify(h1)}`)
    console.log(`   hero=${hero}  CTA=${JSON.stringify(cta)}  sekcije=${JSON.stringify(sections)}`)
    console.log("")
  }
}
main().catch((e) => { console.error(e); process.exit(1) })