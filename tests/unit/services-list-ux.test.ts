import { describe, expect, it } from "vitest"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

// U5 / touch-afrdance regression: service kartica mora imeti vedno viden CTA
// (na touch se opacity-0 nikoli ne prikaže) in i18n label, ne tvrde slovenščine.

const __dirname = dirname(fileURLToPath(import.meta.url))
const servicesListPath = join(__dirname, "../../src/components/services/services-list.tsx")

describe("U5 service kartica UX", () => {
  it("uporablja i18n label za CTA (ne tvrdoljub 'Podrobnosti')", async () => {
    const src = await readFile(servicesListPath, "utf8")
    expect(src).not.toMatch(/>Podrobnosti</)
    expect(src).toContain("t.common.actions.viewDetails")
  })

  it("CTA gumb ni opacity-0 (touch-friendly)", async () => {
    const src = await readFile(servicesListPath, "utf8")
    // Če se CTA kdaj vrne v hidden/hover-only, se test zalomi — na mobilnih
    // opacity-0 nikoli ne postane viden (ni hoverja).
    const ctaStart = src.indexOf("{/* CTA")
    expect(ctaStart).toBeGreaterThan(-1)
    const ctaBlock = src.slice(ctaStart, ctaStart + 600)
    // Izloči JSX komentarje — sam komentar ima besedo "opacity-0".
    const ctaJsx = ctaBlock.replace(/\/\*[\s\S]*?\*\//g, "").trim()
    expect(ctaJsx).not.toContain("opacity-0")
    expect(ctaJsx).not.toContain("translate-y-2")
  })

  it("uporablja i18n provider import za client komponento", async () => {
    const src = await readFile(servicesListPath, "utf8")
    expect(src).toContain('useI18n } from "@/lib/i18n/context"')
  })
})