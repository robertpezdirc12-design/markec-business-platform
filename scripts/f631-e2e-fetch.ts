// F6.3.1 — dejanski prikaz MARKEC javnih strani (E2E verifikacija).
// Zahteva /s/{slug} (proxy middleware preok slož za golo pot + signed x-org-slug)
// in izpiše strukturne markerje (hero varianta, CTAs, sekcije, title) — s čimer
// dokažemo, da se dejavnosti razlikujejo po strukturi, ne le barvi.
import { get as httpGet } from "node:http"

const PORT = Number(process.env.PORT || 3008)
const HOST = "127.0.0.1"

const TENANTS: { slug: string; vert: string; expectName: string }[] = [
  { slug: "mehanik-test", vert: "mehanik", expectName: "Avtomehanika" },
  { slug: "frizer-test", vert: "frizer", expectName: "Frizerski" },
  { slug: "sivilja-test", vert: "seamstress", expectName: "atelje" },
  { slug: "cebelar-test", vert: "beekeeping", expectName: "Čebelar" },
]

function getPage(slug: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpGet(
      { host: HOST, port: PORT, path: `/s/${slug}`, headers: { Host: `localhost:${PORT}` } },
      (res) => {
        let body = ""
        res.on("data", (c) => (body += c))
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }))
      }
    )
    req.on("error", reject)
  })
}

const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
const title = (b: string) => strip((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "")
const h1 = (b: string) => strip((b.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "").slice(0, 110)

/** Zaznaj layout markerje, ki jih oddajo F6.3 hero-variants / sekcije. */
function markers(b: string) {
  const split = /lg:grid-cols-2/.test(b) && /order-first/.test(b)
  const minimal = /max-w-3xl text-center/.test(b)
  const centeredGrad = /bg-linear-to-br/.test(b) || /HeroVideo/.test(b)
  const hero = split ? "SPLIT" : minimal ? "MINIMAL" : centeredGrad ? "CENTERED" : "? (brez markerja)"
  const ctas = ["/booking", "/services", "/shop", "/inquiry", "/contact"].filter((p) =>
    new RegExp(`href=["']${p}`).test(b)
  )
  return {
    hero,
    ctas,
    servicesId: /id="services"/.test(b),
    teamId: /id="team"/.test(b),
    shopId: /id="shop"/.test(b),
    reviewsId: /id="reviews"/.test(b),
  }
}

async function main() {
  console.log(`F6.3.2 — MARKEC javne strani na ${HOST}:${PORT} (direktno /s/{slug})\n`)
  for (const t of TENANTS) {
    const { status, body } = await getPage(t.slug)
    const m = markers(body)
    const hasName = body.includes(t.expectName) || body.includes(t.slug)
    console.log(`— ${t.vert} (${t.slug}) st=${status} title=${JSON.stringify(title(body))}`)
    console.log(`   h1=${JSON.stringify(h1(body))}`)
    console.log(`   hero=${m.hero}  ctas=${JSON.stringify(m.ctas)}  imeTenata=${hasName}`)
    console.log(`   sekcije: services=${m.servicesId} team=${m.teamId} shop=${m.shopId} reviews=${m.reviewsId}`)
    console.log("")
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})