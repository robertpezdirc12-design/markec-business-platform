import { describe, it, expect } from "vitest"
import { orgPath } from "../src/lib/org-path"
import { isSafeNavHref, sanitizeCustomSections } from "../src/lib/site-content"

// Hardening: owner-editable hrefs must never become javascript:/data: links.
describe("orgPath", () => {
  it("prefixes internal paths with the tenant slug", () => {
    expect(orgPath("salon-luna", "/services")).toBe("/s/salon-luna/services")
    expect(orgPath("salon-luna", "/")).toBe("/s/salon-luna")
  })

  it("keeps external and already-prefixed paths intact", () => {
    expect(orgPath("salon-luna", "https://example.com")).toBe("https://example.com")
    expect(orgPath("salon-luna", "/s/salon-luna/booking")).toBe("/s/salon-luna/booking")
  })

  it("falls back to the tenant home for dangerous URL schemes", () => {
    expect(orgPath("salon-luna", "javascript:alert(1)")).toBe("/s/salon-luna")
    expect(orgPath("salon-luna", "  JavaScript:alert(1)")).toBe("/s/salon-luna")
    expect(orgPath("salon-luna", "data:text/html,<script>")).toBe("/s/salon-luna")
    expect(orgPath(null, "vbscript:msgbox(1)")).toBe("/")
  })
})

describe("isSafeNavHref", () => {
  it("allows internal, anchor and known external schemes", () => {
    expect(isSafeNavHref("/booking")).toBe(true)
    expect(isSafeNavHref("#services")).toBe(true)
    expect(isSafeNavHref("https://example.com")).toBe(true)
    expect(isSafeNavHref("mailto:a@b.si")).toBe(true)
    expect(isSafeNavHref("tel:+38612345678")).toBe(true)
  })

  it("rejects executable schemes", () => {
    expect(isSafeNavHref("javascript:alert(1)")).toBe(false)
    expect(isSafeNavHref("data:text/html,x")).toBe(false)
    expect(isSafeNavHref("vbscript:msgbox(1)")).toBe(false)
  })
})

describe("sanitizeCustomSections", () => {
  it("drops a custom-section button with a dangerous href", () => {
    const out = sanitizeCustomSections({
      s1: {
        title: "Naša zgodba",
        paragraphs: ["opis"],
        buttonLabel: "Klikni",
        buttonHref: "javascript:alert(1)",
      },
    })
    expect(out?.s1.buttonHref).toBeUndefined()
    expect(out?.s1.buttonLabel).toBeUndefined()
  })

  it("keeps a safe relative href", () => {
    const out = sanitizeCustomSections({
      s1: {
        title: "Naša zgodba",
        paragraphs: ["opis"],
        buttonLabel: "Klikni",
        buttonHref: "/booking",
      },
    })
    expect(out?.s1.buttonHref).toBe("/booking")
  })
})
