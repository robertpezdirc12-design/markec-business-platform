import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// ============================================================
// U3 — EN VIR RESNICE ZA BOOKING (regresijski varoval)
// U3 zahteva: po odstranitvi demo toka (U1) morajo VSE booking
// povezave (footer, services, staff, CTA) voditi na eno točko
// (/booking), konsistentno org-scoped preko orgPath(). Ta datoteka
// drži, da:
//  - footer spreminja app-poti skozi orgPath (tenant-scoped), ne
//    strenght tele-fixed poglavitnih tokov;
//  - services-page gradi povezave preko orgPath(slug, "/booking…");
//  - services-price-list CTA ni več trdo kodiran bare "/booking",
//    ampak sprejema org-scoped bookUrl prop (+ orgPath fallback).
// ============================================================

const read = (p: string) =>
  readFileSync(__dirname + "/../../" + p, "utf8").replace(/\r\n/g, "\n")

describe("U3 footer: vse app-poti so tenant-scoped", () => {
  it("quickLinks se renderirajo skozi orgPath(slug, link)", () => {
    const f = read("src/components/layouts/footer.tsx")
    // Sam render (Link href) je avtoritativni — tam mora biti orgPath.
    expect(f).toMatch(/href=\{orgPath\(slug, link\.href\)\}/)
  })

  it("booking CTA v footerju gre na orgPath, ne trd /booking", () => {
    const f = read("src/components/layouts/footer.tsx")
    const bookingEntry = f.match(
      /\{ href: "\/booking"[^}]*\}/
    )
    // V quickLinks brand entri pusti bare href, ker render doda orgPath —
    // pomembno je, da uporabni Link (render) NIMA ločene foul case.
    expect(f).toContain("orgPath(slug, link.href)")
  })
})

describe("U3 services: ena konsistentna signing za /booking", () => {
  it("services page vodijo na orgPath(slug, '/booking?service=…')", () => {
    const p = read("src/app/(public)/services/page.tsx")
    expect(p).toContain("orgPath(slug, `/booking?service=${service.slug}`)")
  })

  it("services page 'Rezerviraj' CTA je tudi orgPath (ne bare)", () => {
    const p = read("src/app/(public)/services/page.tsx")
    expect(p).toContain('href={orgPath(slug, content.cta.buttonHref)}')
  })
})

describe("U3 services-price-list: CTA ni trd bare /booking", () => {
  it("sprejema org-scoped bookUrl prop za CTA", () => {
    const s = read("src/components/services/services-price-list.tsx")
    expect(s).toContain("bookUrl?: string")
    expect(s).toContain("bookUrl,")
    expect(s).toContain("href={bookUrl ?? \"/booking\"}")
  })
})