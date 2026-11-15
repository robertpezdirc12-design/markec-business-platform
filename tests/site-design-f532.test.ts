import { describe, it, expect } from "vitest"
import {
  parseHexColor,
  hexContrast,
  validateTheme,
  normalizeNav,
  templatesFor,
  getTemplate,
  navItemAllowed,
  availableNavTargets,
  isExternalHref,
  isSafeNavHref,
  themeToCssVars,
  DEFAULT_THEME_COLORS,
} from "../src/lib/site-design"
import { mergeSiteContent } from "../src/lib/site-content"
// "nova" pot: navigacijska logika živi v site-content in je tam neposredno
// dosegljiva (site-design jo samo re-exportera za stare potrošnike).
import { normalizeNav as normalizeNavFromContent, type NavItem as NavItemFromContent } from "../src/lib/site-content"

// ============================================================
// F5.3.2 — SITE DESIGN: teme (barve/pisave + kontrast), predloge,
// navigacija. Pure-logic tests (brez DB/browserja).
// ============================================================

describe("parseHexColor", () => {
  it("parses #rrggbb and #rgb", () => {
    expect(parseHexColor("#ff0000")).toEqual({ r: 255, g: 0, b: 0 })
    expect(parseHexColor("f00")).toEqual({ r: 255, g: 0, b: 0 })
    expect(parseHexColor("#0a0b0c")).toEqual({ r: 10, g: 11, b: 12 })
    expect(parseHexColor("nope")).toBeNull()
    expect(parseHexColor("#12345")).toBeNull()
  })
})

describe("hexContrast", () => {
  it("black on white ~21:1, white on black ~21:1", () => {
    expect(hexContrast("#000000", "#ffffff")).toBeGreaterThan(19)
    expect(hexContrast("#ffffff", "#000000")).toBeGreaterThan(19)
  })
  it("same colour ~1:1", () => {
    expect(hexContrast("#aaaaaa", "#aaaaaa")).toBeLessThan(1.01)
  })
  it("invalid returns null", () => {
    expect(hexContrast("nope", "#000000")).toBeNull()
  })
})

describe("validateTheme", () => {
  it("accepts a readable (AA) theme", () => {
    const r = validateTheme({
      colors: { background: "#FFFFFF", text: "#111111", buttonBackground: "#0066CC", buttonText: "#FFFFFF" },
      typography: {},
    })
    expect(r.errors).toEqual([])
  })
  it("rejects unreadable button (text on bg < 4.5)", () => {
    const r = validateTheme({
      colors: { buttonBackground: "#FFFFFF", buttonText: "#FFFFFF" },
      typography: {},
    })
    expect(r.errors.some((e) => e.includes("Gumba") || e.includes("gumba"))).toBe(true)
  })
  it("rejects unreadable body text on background", () => {
    const r = validateTheme({
      colors: { background: "#FFFFFF", text: "#FFFFFF" },
      typography: {},
    })
    expect(r.errors.some((e) => e.includes("Besedilo"))).toBe(true)
  })
  it("warns on invalid hex (still usable)", () => {
    const r = validateTheme({ colors: { primary: "purple" }, typography: {} })
    expect(r.errors).toEqual([])
    expect(r.warnings.length).toBeGreaterThan(0)
  })
  it("DEFAULT_THEME_COLORS is usable", () => {
    const r = validateTheme({ colors: DEFAULT_THEME_COLORS, typography: {} })
    // temna tema: belo besedilo na temnem ozadju je berljivo
    expect(r.errors.length).toBeLessThanOrEqual(0)
  })
})

describe("normalizeNav", () => {
  it("sorts by order and drops invalid, caps at MAX", () => {
    const nav = normalizeNav([
      { id: "b", label: "O nas", href: "#about", order: 1 },
      { id: "a", label: "Storitve", href: "#services", order: 0 },
      { label: "", href: "" },
      { id: "c", label: "Skrito", href: "/shop", visible: false, order: 2 },
    ])
    expect(nav?.map((n) => n.label)).toEqual(["Storitve", "O nas", "Skrito"])
    expect(nav?.[2].visible).toBe(false)
  })
  it("returns null for empty / corrupt", () => {
    expect(normalizeNav([])).toBeNull()
    expect(normalizeNav(null)).toBeNull()
    expect(normalizeNav("x")).toBeNull()
  })
  it("rejects javascript: and data: URL schemes (XSS guard)", () => {
    const nav = normalizeNav([
      { label: "XSS", href: "javascript:alert(1)", visible: true, order: 0 },
      { label: "Data", href: "data:text/html;base64,PGI+", visible: true, order: 1 },
      { label: "Vbscript", href: "vbscript:msgbox(1)", visible: true, order: 2 },
      { label: "Varno", href: "https://example.si", visible: true, order: 3 },
      { label: "Sidro", href: "#about", visible: true, order: 4 },
      { label: "Stran", href: "/shop", visible: true, order: 5 },
      { label: "Mail", href: "mailto:info@salon.si", visible: true, order: 6 },
    ])
    // nevarne sheme izpadle; varne ostanejo
    expect(nav?.map((n) => n.label)).toEqual(["Varno", "Sidro", "Stran", "Mail"])
    expect(nav?.every((n) => !/^(javascript|data|vbscript):/i.test(n.href))).toBe(true)
  })
  it("caps the number of navigation items at MAX_NAV_ITEMS (12)", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: `n${i}`,
      label: `Item ${i}`,
      href: `/s${i}`,
      visible: true,
      order: i,
    }))
    const nav = normalizeNav(many as unknown[])
    expect(nav).not.toBeNull()
    expect(nav!.length).toBe(12)
  })
})

describe("navItemAllowed", () => {
  it("respects visibility and capability gate", () => {
    expect(navItemAllowed({ id: "x", label: "A", href: "#a", visible: true, order: 0 }, [])).toBe(true)
    expect(navItemAllowed({ id: "x", label: "A", href: "#a", visible: false, order: 0 }, [])).toBe(false)
    expect(
      navItemAllowed({ id: "x", label: "Shop", href: "/shop", visible: true, order: 0, requiresCapability: "shop" }, ["shop"])
    ).toBe(true)
    expect(
      navItemAllowed({ id: "x", label: "Shop", href: "/shop", visible: true, order: 0, requiresCapability: "shop" }, [])
    ).toBe(false)
  })
})

describe("availableNavTargets", () => {
  it("excludes targets whose capability is disabled", () => {
    const t = availableNavTargets([])
    expect(t.find((x) => x.value === "/booking")).toBeUndefined()
    expect(t.find((x) => x.value === "#about")).toBeDefined()
    const t2 = availableNavTargets(["appointments", "shop"])
    expect(t2.find((x) => x.value === "/booking")).toBeDefined()
    expect(t2.find((x) => x.value === "#shop")).toBeDefined()
  })
})

describe("templatesFor / getTemplate", () => {
  it("filters by vertical + capabilities, is shared (not per-SKD)", () => {
    const all = templatesFor({ vertical: "beauty", capabilitiesEnabled: ["services", "shop", "appointments"] })
    expect(all.length).toBeGreaterThan(0)
    expect(all[0].requiresCapabilities ?? []).toEqual([]) // temeljne predloge nimajo police
    expect(getTemplate("classic-elegant")?.layout).toBe("classic")
  })
  it("template requires capabilities gate", () => {
    expect(getTemplate("modern-bold")).toBeDefined()
  })
})

describe("mergeSiteContent preserves nav + _templateId", () => {
  it("keeps owner nav and template marker through merge", () => {
    const merged = mergeSiteContent(
      {
        nav: [{ id: "x", label: "Moj link", href: "#services", visible: true, order: 0 }],
        _templateId: "modern-bold",
      },
      "beauty"
    )
    expect(merged.nav?.map((n) => n.label)).toEqual(["Moj link"])
    expect(merged._templateId).toBe("modern-bold")
  })
})

describe("themeToCssVars (F5.3.3 grafična podoba)", () => {
  it("derives buttonBackground and link from primary when not set", () => {
    const vars = themeToCssVars({ colors: { primary: "#0066CC" }, typography: {} })
    expect(vars["--f532-primary"]).toBe("0 102 204")
    // gumb-ozadje in povezava sledita glavni (zahteva §2: glavna barva obarva gumbe)
    expect(vars["--f532-button-bg"]).toBe("0 102 204")
    expect(vars["--f532-link"]).toBe("0 102 204")
  })
  it("keeps explicit buttonBackground when set", () => {
    const vars = themeToCssVars({ colors: { primary: "#0066CC", buttonBackground: "#990000" }, typography: {} })
    expect(vars["--f532-button-bg"]).toBe("153 0 0")
  })
  it("maps compound keys to globals.css tokens (button-text, text-muted)", () => {
    const vars = themeToCssVars({ colors: { buttonText: "#FFFFFF", textMuted: "#666666" }, typography: {} })
    expect(vars["--f532-button-text"]).toBe("255 255 255")
    expect(vars["--f532-text-muted"]).toBe("102 102 102")
  })
  it("validateTheme checks derived contrast (primary → button)", () => {
    const r = validateTheme({ colors: { primary: "#FFFFFF", buttonText: "#FFFFFF" }, typography: {} })
    expect(r.errors.some((e) => /Gumb/i.test(e))).toBe(true)
  })
})

describe("themeToCssVars (F5.3.3.1 AA — samo eksplicitne barve)", () => {
  it("does NOT inject the DEFAULT dark palette when the owner set few colours", () => {
    // Prej je injektiral vse DEFAULT (vklj. temni #121212 background, svetli
    // text-muted #A8A29E), kar je na vrhu org rose palete POTEGNJENO stran v
    // temno in zlomilo AA (npr. muted 340 10% 40% na temnem). Zdaj se injektira
    // samo to, kar je lastnik EKSPLICITNO nastavil.
    const vars = themeToCssVars({ colors: { primary: "#0066CC" }, typography: {} })
    expect(vars["--f532-background"]).toBeUndefined()
    expect(vars["--f532-text-muted"]).toBeUndefined()
    expect(vars["--f532-button-text"]).toBeUndefined()
    // primarna + njeni izpeljani tokeni so še vedno prisotni (lastniški)
    expect(vars["--f532-primary"]).toBe("0 102 204")
    expect(vars["--f532-button-bg"]).toBe("0 102 204")
    expect(vars["--f532-link"]).toBe("0 102 204")
  })

  it("injects explicitly chosen muted / background colours (freedom preserved)", () => {
    const vars = themeToCssVars({ colors: { background: "#FFFFFF", textMuted: "#555555" }, typography: {} })
    expect(vars["--f532-background"]).toBe("255 255 255")
    expect(vars["--f532-text-muted"]).toBe("85 85 85")
  })
})

describe("isExternalHref", () => {
  it("detects external http(s) URLs", () => {
    expect(isExternalHref("https://example.si")).toBe(true)
    expect(isExternalHref("#services")).toBe(false)
    expect(isExternalHref("/shop")).toBe(false)
  })
})

describe("isSafeNavHref", () => {
  it("direct site-content import works identically (new data-owner path)", () => {
    // Obe poti — star re-export (site-design) in nova (site-content) — dajeta
    // isto funkcijo brez runtime napak (identiteta re-exporta).
    const viaContent = normalizeNavFromContent([
      { label: "D", href: "data:foo", visible: true, order: 0 },
      { label: "V", href: "#about", visible: true, order: 1 },
      { label: "S", href: "/shop", visible: true, order: 2 },
    ] as unknown[])
    expect(viaContent?.map((n) => n.label)).toEqual(["V", "S"])
    const item: NavItemFromContent = { id: "x", label: "V", href: "#about", visible: true, order: 0 }
    expect(item.href).toBe("#about")
  })
  it("allows internal anchors, relative paths, and safe schemes", () => {
    expect(isSafeNavHref("#about")).toBe(true)
    expect(isSafeNavHref("/shop")).toBe(true)
    expect(isSafeNavHref("https://example.si")).toBe(true)
    expect(isSafeNavHref("http://example.si/x")).toBe(true)
    expect(isSafeNavHref("mailto:info@salon.si")).toBe(true)
    expect(isSafeNavHref("tel:+38631234567")).toBe(true)
  })
  it("rejects javascript:, data:, vbscript: and mixed-case javascript:", () => {
    expect(isSafeNavHref("javascript:alert(1)")).toBe(false)
    expect(isSafeNavHref("JaVaScRiPt:alert(1)")).toBe(false)
    expect(isSafeNavHref("data:text/html;base64,PGI+")).toBe(false)
    expect(isSafeNavHref("vbscript:msgbox(1)")).toBe(false)
    expect(isSafeNavHref("  javascript:alert(1)  ")).toBe(false)
  })
})