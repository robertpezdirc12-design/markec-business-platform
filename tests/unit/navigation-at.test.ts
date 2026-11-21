import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// ============================================================
// Navigacija (public-navbar) + demo-tour: AT stanje, Escape,
// žive regije za napredovanje.
// ============================================================

const ROOT = join(__dirname, "..", "..")
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n")

describe("public-navbar — mobilni menu AT-state", () => {
  const f = () => read("src/components/layouts/public-navbar.tsx")

  it("toggle napove stanje prek aria-expanded in poveže kontrolo aria-controls", () => {
    const s = f()
    expect(s).toContain('aria-expanded={mobileMenuOpen}')
    expect(s).toContain('aria-controls="mobile-nav"')
    expect(s).toContain('id="mobile-nav"')
    expect(s).toContain('aria-label={t.public.toggleMenu}')
  })

  it("Escape zapre menu in vrne fokus na toggle", () => {
    const s = f()
    expect(s).toContain('mobileMenuToggleRef = useRef<HTMLButtonElement>(null)')
    expect(s).toContain('ref={mobileMenuToggleRef}')
    expect(s).toContain('if (e.key === "Escape") {')
    expect(s).toContain('setMobileMenuOpen(false)')
    expect(s).toContain("mobileMenuToggleRef.current?.focus()")
  })
})

describe("demo-tour — AT-napoved napredovanja (avtoplay)", () => {
  it("stalna sr-only živa regija napove Korak X od N + naslov", () => {
    const s = read("src/components/landing/demo-tour.tsx")
    expect(s).toContain('<p role="status" aria-live="polite" className="sr-only">')
    expect(s).toContain('`Korak ${index + 1} od ${count}: ${current.title}`')
    // stale: DialogTitle/Description ostanejo sr-only
    expect(s).toContain('<DialogTitle className="sr-only">')
  })
})