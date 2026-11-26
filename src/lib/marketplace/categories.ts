// ============================================================
// IMENIK KATEGORIJ TRŽNICE — en vir za /kategorije/[slug],
// noge in stranske sezname.
//
// Audit 2026-11-18: noga tržnice je kazala na /kategorije/frizerski-saloni,
// ki ni obstajala (404). Poleg tega so bile kategorije v
// browse-by-location.tsx opremljene z izmišljenimi števci (96, 128 …),
// čeprav v platformi ni bilo toliko podjetij. Tu so zato SAMO resnične
// kategorije, števce pa izračuna klicatelj iz snapshot-a.
//
// `verticals` so vrednosti, ki jih snapshot zapiše v polje `type`/`category`
// (id dejavnosti iz src/lib/profiles/registry.ts). Ujemanje je natančno —
// zato kategorija nikoli ne pokaže tujega podjetja.
//
// ARHITEKTURA DVEH DREVES (2026-11-25, po zgledu Taobao / Yelp / Google):
//   ZALEDJE: SKD 2025 = 1725 vozlov / 678 podrazredov, ena koda na subjekt,
//            državni standard za register, davke in statistiko.
//   PRESLIKAVA: polje `verticals` (N:N, brez kod) — ta datoteka.
//   PREDNJA STRAN: 14 kuriranih kategorij za iskanje in odkrivanje.
// SKD se zato NE sme prikazovati v uporabniškem vmesniku: njegovi listi so
// pregrobi (npr. T96.210 združuje frizerje in brivce) in vsebujejo panoge,
// ki za obiskovalca tržnice niso smiselne (orožje, javna uprava, kmetijstvo).
// Novo področje/oznako dodaj SEM, v `MARKETPLACE_CATEGORIES`, ne v SKD.
// ============================================================

export interface MarketplaceCategory {
  slug: string
  label: string
  icon: string
  /** Id-ji dejavnosti, ki sodijo v to kategorijo. */
  verticals: string[]
  /** Kratek opis za podnaslov strani (SEO + orientacija). */
  description: string
}

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  {
    slug: "frizerski-saloni",
    label: "Frizerski saloni",
    icon: "✂️",
    verticals: ["frizer"],
    description: "Striženje, barvanje in nega las.",
  },
  {
    slug: "brivci",
    label: "Brivci",
    icon: "💈",
    verticals: ["barber"],
    description: "Moško striženje, britje in urejanje brade.",
  },
  {
    slug: "kozmeticni-saloni",
    label: "Kozmetični saloni",
    icon: "💅",
    verticals: ["cosmetica", "beauty"],
    description: "Nega obraza, tretmaji in lepotne storitve.",
  },
  {
    slug: "nohti",
    label: "Nohti",
    icon: "💅",
    verticals: ["nails"],
    description: "Manikura, pedikura in oblikovanje nohtov.",
  },
  {
    slug: "masazni-saloni",
    label: "Masažni saloni",
    icon: "💆",
    verticals: ["massage"],
    description: "Sprostitvene in terapevtske masaže.",
  },
  {
    slug: "depilacija",
    label: "Depilacija",
    icon: "🌸",
    verticals: ["epilation"],
    description: "Trajno in klasično odstranjevanje dlak.",
  },
  {
    slug: "siviljstvo",
    label: "Šiviljstvo in atelje",
    icon: "🧵",
    verticals: ["seamstress"],
    description: "Popravila, krajšanja in šivanje po meri.",
  },
  {
    slug: "oblacilne-delavnice",
    label: "Oblačilne delavnice",
    icon: "👗",
    verticals: ["apparel"],
    description: "Oblačila po meri in serijska proizvodnja.",
  },
  {
    slug: "tetovirni-studii",
    label: "Tetovirni studii",
    icon: "🖋️",
    verticals: ["tattoo-studio"],
    description: "Tetoviranje in pirsing po terminih.",
  },
  {
    slug: "avtoservis",
    label: "Avtoservis in vulkanizer",
    icon: "🔧",
    verticals: ["mehanik", "tire-service"],
    description: "Servis vozil, menjava pnevmatik in popravila.",
  },
  {
    slug: "cebelarstvo",
    label: "Čebelarstvo",
    icon: "🍯",
    verticals: ["beekeeping"],
    description: "Med, čebelji izdelki in pridelava.",
  },
  {
    slug: "drugo",
    label: "Drugo",
    icon: "🏪",
    verticals: ["generic"],
    description: "Podjetja z drugimi ali splošnimi storitvami.",
  },
]

const BY_SLUG = new Map(MARKETPLACE_CATEGORIES.map((c) => [c.slug, c]))

export function getMarketplaceCategory(slug: string): MarketplaceCategory | null {
  return BY_SLUG.get(slug) ?? null
}

/**
 * Število resničnih podjetij na kategorijo (iz snapshot-a).
 * Uporablja se v stranskih seznamih, da števec ni izmišljen.
 */
export function countByCategory(
  businesses: { type?: string | null; category?: string | null }[]
): Record<string, number> {
  const byVertical = new Map<string, number>()
  for (const b of businesses) {
    const key = (b.category || b.type || "").trim()
    if (!key) continue
    byVertical.set(key, (byVertical.get(key) ?? 0) + 1)
  }
  const result: Record<string, number> = {}
  for (const cat of MARKETPLACE_CATEGORIES) {
    result[cat.slug] = cat.verticals.reduce((sum, v) => sum + (byVertical.get(v) ?? 0), 0)
  }
  return result
}

/** Podjetja, ki res sodijo v kategorijo (natančno po dejavnosti). */
export function businessesInCategory<T extends { type?: string | null; category?: string | null }>(
  businesses: T[],
  category: MarketplaceCategory
): T[] {
  const allowed = new Set(category.verticals)
  return businesses.filter((b) => allowed.has((b.category || b.type || "").trim()))
}
