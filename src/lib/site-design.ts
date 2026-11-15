// ============================================================
// SITE DESIGN (F5.3.2) — one shared system for design templates,
// owner-editable theme (colors, typography) and navigation.
//
// All three live in EXISTING storage — no migration:
//  - theme  → SalonConfig.theme  (Json)
//  - nav    → SiteContent.nav    (Json, draft/published snapshot)
//  - template selection → siteContent._templateId (Json marker)
//
// Reuses the vertical/palette/contrast system in lib/verticals.ts and
// the SiteContent/SectionKey model in lib/site-content.ts. No duplicate
// design store, no per-SKD template code.
// ============================================================

import type { FontKey } from "@/lib/verticals"
import type { SectionKey } from "@/lib/site-content"

// ------------------------------------------------------------
// Owner-editable THEME (colors + typography).
// ------------------------------------------------------------

export interface ThemeColors {
  /** Glavna barva (primarna — gumbi, povezave). */
  primary: string
  /** Sekundarna barva. */
  secondary: string
  /** Poudarjena barva (CTA, oznake). */
  accent: string
  /** Ozadje strani. */
  background: string
  /** Alternativno ozadje (sekcije, kartice). */
  backgroundAlt: string
  /** Besedilo. */
  text: string
  /** Manj poudarjeno besedilo. */
  textMuted: string
  /** Barva naslovov. */
  heading: string
  /** Povezave. */
  link: string
  /** Gumb — besedilo. */
  buttonText: string
  /** Gumb — ozadje. */
  buttonBackground: string
}

export interface ThemeTypography {
  fontHeading: FontKey
  fontBody: FontKey
  /** Napoved velikosti naslovov (1 = privzeto). */
  headingScale: number
  /** Osnovna pisava [px]. */
  baseFontSize: number
  /** Debelina navadnega besedila. */
  fontWeight: "normal" | "medium" | "semibold"
}

/** Stanje, ki ga lastnik ureja. Popolno-default-uporabi pri renderju. */
export interface SiteTheme {
  colors: Partial<ThemeColors>
  typography: Partial<ThemeTypography>
}

/** Privzete vrednosti za prikaz/normalizacijo. */
export const DEFAULT_THEME_COLORS: ThemeColors = {
  primary: "#B84A30",
  secondary: "#7C2D12",
  accent: "#B45309",
  background: "#121212",
  backgroundAlt: "#171717",
  text: "#F5F5F4",
  textMuted: "#A8A29E",
  heading: "#FFFFFF",
  link: "#B84A30",
  buttonText: "#FFFFFF",
  buttonBackground: "#B84A30",
}

export const DEFAULT_TYPOGRAPHY: ThemeTypography = {
  fontHeading: "poppins",
  fontBody: "inter",
  headingScale: 1,
  baseFontSize: 16,
  fontWeight: "normal",
}

/** HEX → parsed. Nil on invalid. */
export function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function luminanceHex(hex: string): number | null {
  const c = parseHexColor(hex)
  if (!c) return null
  const lin = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
}

/** WCAG contrast ratio (§1.4.3) between two hex colours, or null on invalid. */
export function hexContrast(a: string, b: string): number | null {
  const la = luminanceHex(a)
  const lb = luminanceHex(b)
  if (la == null || lb == null) return null
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * F5.3.2 — validiraj temo za berljivost. Vrne niz napak, ki preprečijo
 * objavo/uporabo nečitljive kombinacije. Napačne/vnešene barve → warning
 * (uporabi modrejšo privzeto), a izrecno slabe AA kombinacije gumba/besedila
 * in besedila/ozadja so NAPAKA, ker delajo stran nečitljivo.
 */
export function validateTheme(theme: SiteTheme): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  // F5.3.3 — izpeljane vrednosti prikazovanja: ko lastnik nastavi le primarno,
  // gumb-ozadje in povezava prevzamejo primarno (enako kot themeToCssVars), da
  // kontrast preverja REALNE vrednosti, ki jih bo stran dejansko uporabila.
  const provided: Partial<ThemeColors> = { ...theme.colors }
  const effective: Partial<ThemeColors> = {
    ...provided,
    ...(!provided.buttonBackground && provided.primary ? { buttonBackground: provided.primary } : {}),
    ...(!provided.link && provided.primary ? { link: provided.primary } : {}),
  }
  const col = { ...DEFAULT_THEME_COLORS, ...effective }

  const badHex = (name: string, val: string) => {
    if (!parseHexColor(val)) warnings.push(`${name}: barva "${val}" ni veljavna HEX — uporabljen bo privzet odtenek.`)
  }
  badHex("Glavna", col.primary)
  badHex("Poudarjena", col.accent)
  badHex("Ozadje", col.background)
  badHex("Besedilo", col.text)
  badHex("Gumb", col.buttonBackground)

  // Gumb: besedilo na ozadju gumba mora biti AA (≥4.5:1).
  const btnC = hexContrast(col.buttonText, col.buttonBackground)
  if (btnC != null && btnC < 4.5) {
    errors.push(`Besedilo gumba (${col.buttonText}) ni berljivo na ozadju gumba (${col.buttonBackground}); najmanj 4.5:1 (trenutno ${btnC.toFixed(2)}:1).`)
  }
  // Besedilo: besedilo na ozadju strani.
  const textC = hexContrast(col.text, col.background)
  if (textC != null && textC < 4.5) {
    errors.push(`Besedilo (${col.text}) ni berljivo na ozadju (${col.background}); najmanj 4.5:1 (trenutno ${textC.toFixed(2)}:1).`)
  }
  // Naslovi na ozadju.
  const headC = hexContrast(col.heading, col.background)
  if (headC != null && (headC < 3 || (headC >= 3 && headC < 4.5))) {
    warnings.push(`Naslovi (${col.heading}) na ozadju (${col.background}) so manj berljivi (${headC.toFixed(2)}:1) — priporočeno ≥4.5:1.`)
  }
  // Povezave na ozadju.
  const linkC = hexContrast(col.link, col.background)
  if (linkC != null && linkC < 3) {
    warnings.push(`Povezave (${col.link}) na ozadju (${col.background}) so slabo berljive (${linkC.toFixed(2)}:1).`)
  }
  return { errors, warnings }
}

/** Vsa polja tema v CSS custom props, ki jih layout vbrizga (preko org-theme).
 *  Ključi se izpišejo v kebab-case IN usklajeni z tokeni, ki jih bere globals.css
 *  (--f532-button-bg, --f532-button-text, --f532-text-muted, …). Pred F5.3.3 so
 *  se camelCase ključi (--f532-buttonBackground) ne ujemali z globals tokeni in
 *  so lastnikove barve za gumbe/sek. besedilo ostale nedosežene — zdaj so preslikane.
 *
 *  F5.3.3.1 (AA korektura): injektira se SAMO tisto, kar je lastnik EKSPLICITNO
 *  nastavil (navaden `theme.colors`), nikoli celotna DEFAULT paleta. Razlog: če bi
 *  vbrizgali vse DEFAULT vrednosti (npr. temni `background #121212`, svetli
 *  text-muted #A8A29E), bi to PREMAGALO shadcn svetle/temne AA-skalirane tokene
 *  — svetel naravni `rose` red bi postal temen in na msl-nek valjah bi bil kontrast
 *  nestranski. Z eksplicitno-lastniško injekcijo ostane privzeta (ne-tuknjena)
 *  tema AA čista, lastnik pa lahko nadgradi le barve, ki jih res izbere. */
export function themeToCssVars(theme: SiteTheme): Record<string, string> {
  // F5.3.3 — ko lastnik nastavi le primarno barvo (Glavna), se iz nje izpelje:
  //  - buttonBackground → Glavna = primarna barva za gumbe (zahteva §2)
  //  - link → povezava uporablja isto primarno
  // Tako sprememba "Glavne" resnično pobarva gumbe/povezave, ne le shrani
  // nedosegljiv token. Eksplicitno nastavljen `buttonBackground`/`link` zmaga.
  const effective: Partial<ThemeColors> = { ...theme.colors }
  if (!effective.buttonBackground && effective.primary) effective.buttonBackground = effective.primary
  if (!effective.link && effective.primary) effective.link = effective.primary
  // F5.3.3.1 — samo eksplicitno nastavljene barve (glej komentar zgoraj).
  const col = effective
  const typo = { ...DEFAULT_TYPOGRAPHY, ...theme.typography }
  // tema → globals token (kebab-case). Enobesedni ključi (primary, link,
  // heading, text, background …) ostanejo, zloženke dobijo globals vezaji.
  const tokenKey = (k: keyof ThemeColors): string => {
    const map: Record<keyof ThemeColors, string> = {
      primary: "primary",
      secondary: "secondary",
      accent: "accent",
      background: "background",
      backgroundAlt: "background-alt",
      text: "text",
      textMuted: "text-muted",
      heading: "heading",
      link: "link",
      buttonText: "button-text",
      buttonBackground: "button-bg",
    }
    return map[k]
  }
  const out: Record<string, string> = {}
  for (const [k, vRaw] of Object.entries(col) as [keyof ThemeColors, string][]) {
    const c = parseHexColor(vRaw)
    if (c) out[`--f532-${tokenKey(k)}`] = `${c.r} ${c.g} ${c.b}`
  }
  out["--f532-heading-scale"] = String(typo.headingScale)
  out["--f532-base-font-size"] = `${typo.baseFontSize}px`
  return out
}

// ------------------------------------------------------------
// TEMPLATES — reusable design templates, filtered by vertical +
// capabilities. Each template = a design intent (section order,
// base palette, theme deltas). Switching preserves content via
// mergeSiteContent (user text/images win).
// ------------------------------------------------------------

export type TemplateLayout = "classic" | "modern" | "minimal"

export interface SiteTemplate {
  id: string
  name: string
  description: string
  /** null → velja za vse dejavnosti; sicer seznam vertical IDs. */
  verticals?: string[] | null
  /** capability keys, ki jih posamezen workspace mora imeti omogočene, da je predloga ponujena.
   *  (capabilities arrays; npr. "services", "shop", "appointments") */
  requiresCapabilities?: string[]
  layout: TemplateLayout
  /** Katera usmerjena paleta je osnova (te.design palete). */
  basePaletteId: string
  /** Opcijsko prekrivanje teme nad osnovno paleto. */
  theme?: Partial<SiteTheme>
  /** Privzet vrstni red sekcij; omogočenih se upošteva le tiste, ki obstajajo. */
  sectionOrder?: SectionKey[]
}

/** Predloge so SKUPNE (ne per-SKD) — uporabijo se za vsako dejavnost; aktivne so
 *  le tiste, ki ustrezajo capability-jem workspacea. Nobene ločene kode po SKD. */
export const SITE_TEMPLATES: SiteTemplate[] = [
  {
    id: "classic-elegant",
    name: "Klasična elegantna",
    description: "Topla, z zlatimi poudarki in usklajenimi pisavami. Primerna za salone in obrt.",
    layout: "classic",
    basePaletteId: "rose",
    sectionOrder: ["hero", "about", "features", "services", "team", "reviews", "shop", "cta"],
  },
  {
    id: "modern-bold",
    name: "Sodobna odločna",
    description: "Močna primarna barva, velike kartice, sodobna tipografija. Za akcijske storitve.",
    layout: "modern",
    basePaletteId: "charcoal",
    sectionOrder: ["hero", "features", "services", "about", "team", "reviews", "cta", "shop"],
    theme: { typography: { fontHeading: "oswald", fontWeight: "semibold" } },
  },
  {
    id: "minimal-light",
    name: "Minimalistična svetla",
    description: "Bela, prostorna, s poudarkom na fotografiji in berljivosti.",
    layout: "minimal",
    basePaletteId: "emerald",
    sectionOrder: ["hero", "services", "about", "features", "team", "reviews", "cta"],
    theme: { colors: { background: "#FFFFFF", text: "#1C1917" }, typography: { fontHeading: "poppins" } },
  },
  {
    id: "romantic-script",
    name: "Romantična rokopisna",
    description: "Rokopisni naslovi, mehke barve — za kozmetiko, cvetličarne, oblikovanje.",
    layout: "classic",
    basePaletteId: "violet",
    sectionOrder: ["hero", "about", "features", "services", "team", "reviews", "shop", "cta"],
    theme: { typography: { fontHeading: "cormorant" } },
  },
]

export function getTemplate(id: string): SiteTemplate | undefined {
  return SITE_TEMPLATES.find((t) => t.id === id)
}

/** Predloge, veljavne za dani vertical + capabilities workspacea. */
export function templatesFor(
  opts: { vertical: string | null } & { capabilitiesEnabled: string[] }
): SiteTemplate[] {
  return SITE_TEMPLATES.filter((t) => {
    if (t.verticals && !t.verticals.includes(opts.vertical ?? "")) return false
    if (t.requiresCapabilities) {
      for (const cap of t.requiresCapabilities) {
        if (!opts.capabilitiesEnabled.includes(cap)) return false
      }
    }
    return true
  })
}

// ------------------------------------------------------------
// NAVIGATION — re-exported from site-content (the data owner, since
// nav lives in SiteContent.nav). Kept here so existing consumers
// of "@/lib/site-design" keep their imports, while site-content no
// longer imports runtime code from site-design (breaks the cycle
// site-design ↔ site-content and site-design ↔ verticals).
// ------------------------------------------------------------

export {
  type NavItem,
  MAX_NAV_ITEMS,
  normalizeNav,
  availableNavTargets,
  navItemAllowed,
  isExternalHref,
  isSafeNavHref,
} from "@/lib/site-content"