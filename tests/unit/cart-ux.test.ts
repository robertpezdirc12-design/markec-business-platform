import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// ============================================================
// Baymard / NN/g status visibility: async izidi (checkout, promo,
// gift card, brisanje košarice) morajo imeti nedvoumen loading
// feedback + AT-napoved (role="status" / aria-live) — ne samo
// spinner na disabled gumbu, ki ga bralnik izpusti.
// ============================================================

const ROOT = join(__dirname, "..", "..")
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n")

describe("shop/cart — AT-status med async operacijami", () => {
  it("checkout gumb ima loading spinner in isCheckingOut guard", () => {
    const c = read("src/components/shop/cart-content.tsx")
    expect(c).toContain("items.length === 0 || isCheckingOut || status === \"loading\"")
    expect(c).toContain('<CircleNotch size={20} className="animate-spin" />')
  })

  it("checkout ima stalno role=status regijo, ki ob isCheckingOut napove napredek", () => {
    const c = read("src/components/shop/cart-content.tsx")
    // NAJVEČ: live region je v DOM od začetka (ne pogojen!) → AT ga registrira
    expect(c).toContain('<p role="status" className="sr-only" aria-live="polite">')
    expect(c).toContain("isCheckingOut")
    expect(c).toContain("Ustvarjam plačilno sejo…")
    expect(c).toContain("Creating payment session…")
  })

  it("gift card in promo imata role=status napoved veljavnosti", () => {
    const c = read("src/components/shop/cart-content.tsx")
    // za darilni bon in promocijsko kodo najdemo live region za sporočilo
    expect(c.match(/role="status"/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it("add-to-cart gumb napove 'Dodano v košarico' za bralnik (live regija stalno v DOM)", () => {
    const a = read("src/components/shop/add-to-cart-button.tsx")
    expect(a).toContain('<p role="status" className="sr-only" aria-live="polite">')
    expect(a).toContain("{added ? pick(locale, \"Dodano v košarico\", \"Added to cart\") : \"\"}")
    expect(a).toContain("setAdded(true)")
  })

  it("landing product-card: dodajo v košarico ima AT-napoved (CheckIcon + role=status)", () => {
    const p = read("src/components/landing/product-card.tsx")
    expect(p).toContain('<p role="status" className="sr-only" aria-live="polite">')
    expect(p).toContain("{added ? t.public.addedToCart : \"\"}")
    expect(p).toContain("added ? <CheckIcon size={16} aria-hidden /> : <ToteIcon size={16} aria-hidden />")
    const pub = read("src/lib/i18n/dict/public.ts")
    expect(pub).toContain('addedToCart: "Dodano v košarico",')
    expect(pub).toContain('addedToCart: "Added to cart",')
  })

  it("variant-selector: razprodane variante so AT-dostopne (aria-disabled, ne disabled)", () => {
    const v = read("src/components/shop/variant-selector.tsx")
    expect(v).toContain("aria-disabled={out}")
    expect(v).toContain("aria-pressed={isSel}")
    // onClick guard še vedno prepreči izbor razprodane variante
    expect(v).toContain("onClick={() => v.stockQuantity > 0 && setSelectedId(v.id)}")
    // bralnik prebere ime + nedostopnost
    expect(v).toContain("`Ni na zalogi: ${v.name}`")
    expect(v).toContain("out && \"opacity-50 line-through\"")
  })
})