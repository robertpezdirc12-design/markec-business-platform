// ============================================================
// F6.3 — LAYOUT MANIFEST za javno spletno stran po dejavnosti.
//
// Do F6.3 je bila celotna domača stran ena fiksna struktura: sekcije
// so se le capability-gate-ale (kateri so prikazane) in renderile v
// istem vizualnem vzorcu (velik centered hero, services cards itd.),
// ne glede na dejavnost. `_templateId` se je shranjeval, renderer pa ga
// ni upošteval (F5.5 revizija).
//
// Ta modul preslika (1) izbrano predlogo (`content._templateId`) in
// (2) poslovni profil (dejavnost) v dejanski LAYOUT manifest: razpored/
// hierarhijo sekcij in hero strukturo — NE samo barve. Renderer
// (`home-content`) ga prebere in renderira različno strukturo za npr.
// frizer (centered hero + storitve), mehanika (split hero + delovni
// nalog), šiviljo (minimal hero + povpraševanje), čebelarja (products
// prvi + minimal).
//
// Zasnovano razširljivo: dodajanje nove predloge/dejavnosti = nov vnos
// v map, brez nove solve strukture. Brez sheme, brez migracije.
// ============================================================

export type HeroVariant = "centered" | "split" | "minimal"

export type PrimaryHome = "services" | "products" | "workflow" | "features"

export interface LayoutManifest {
  /** Struktura heroja (predstavitveno območje). */
  heroVariant: HeroVariant
  /** Katera sekcija je gravitacijsko osrednja (takoj za herojem). */
  primary: PrimaryHome
  /** Ali izpostavimo statistiko/N-revizijo pod herojem. */
  showStats: boolean
  /** Ali je glavni CTA poudarjen velik ali skromen. */
  prominentCta: boolean
}

export const DEFAULT_MANIFEST: LayoutManifest = {
  heroVariant: "centered",
  primary: "services",
  showStats: true,
  prominentCta: true,
}

// Predloge (z `_templateId`) → layout manifest.
const BY_TEMPLATE: Record<string, Partial<LayoutManifest>> = {
  "minimal-light": { heroVariant: "minimal", showStats: false, prominentCta: false },
  "modern-bold": { heroVariant: "split", prominentCta: true },
  "classic-elegant": { heroVariant: "centered", showStats: true, prominentCta: true },
  "romantic-script": { heroVariant: "centered", showStats: false, prominentCta: true },
}

// Poslovni profili (id iz profiles/registry) → layout manifest.
// Primarna hierarhija glede na vrsto dejavnosti, ne barvo.
const BY_PROFILE: Record<string, Partial<LayoutManifest>> = {
  // Produktni/pridelovalni profil: izdelki so osrednji, minimalna predstava.
  beekeeping: { heroVariant: "minimal", primary: "products", showStats: false },
  // Delavniški/servisni: hero split + poudarjen CTA na servis/delovni nalog.
  "tire-service": { heroVariant: "split", primary: "workflow", showStats: true, prominentCta: true },
  mehanik: { heroVariant: "split", primary: "workflow", showStats: true, prominentCta: true },
  // Atelje/šivilja: povpraševanje je osrednje, skromna predstava.
  seamstress: { heroVariant: "minimal", primary: "workflow", showStats: false, prominentCta: false },
  // Lepota/rezervacijski: centered karske predstava + storitve.
  beauty: { heroVariant: "centered", primary: "services", showStats: true, prominentCta: true },
  frizer: { heroVariant: "centered", primary: "services", showStats: true, prominentCta: true },
  barber: { heroVariant: "centered", primary: "services", showStats: true, prominentCta: true },
  nails: { heroVariant: "centered", primary: "services", showStats: true, prominentCta: true },
  cosmetica: { heroVariant: "centered", primary: "services", showStats: true, prominentCta: true },
  massage: { heroVariant: "centered", primary: "services", showStats: false, prominentCta: true },
  epilation: { heroVariant: "centered", primary: "services", showStats: false, prominentCta: true },
}

/**
 * Privzeta obl. predloga (SITE_TEMPLATES id) za poslovni profil.
 * Uporablja se ob materializaciji/onboarding, da dejavnost takoj dobi
 * primerno strukturo (hero/hierarhija), ki jo renderer iz ris e upošteva.
 */
const DEFAULT_TEMPLATE_BY_PROFILE: Record<string, string> = {
  // Delavniški/servisni → split hero + odločna struktura.
  mehanik: "modern-bold",
  "tire-service": "modern-bold",
  // Šivilja / atelje → minimalni, prostren.
  seamstress: "minimal-light",
  // Pridelovalec → minimalni + izdelki.
  beekeeping: "minimal-light",
  // Lepota/rezervacijski → klasična elegantna (centered).
  beauty: "classic-elegant",
  frizer: "classic-elegant",
  barber: "classic-elegant",
  nails: "classic-elegant",
  cosmetica: "classic-elegant",
  massage: "classic-elegant",
  epilation: "classic-elegant",
}
const DEFAULT_FALLBACK_TEMPLATE = "classic-elegant"

export function defaultTemplateForProfile(profileId: string | null | undefined): string {
  return (profileId && DEFAULT_TEMPLATE_BY_PROFILE[profileId]) || DEFAULT_FALLBACK_TEMPLATE
}

/**
 * Zgradi celoten manifest za dani `_templateId` in profil.
 * Predloga (marker) je močnejša od privzetega profila; profile je bolj
 * specifična (dejavnost) in dopolni/prevlada splošno predlogo po ključu.
 * Če ni nič znanega → GENERIC (varno, ne lomi).
 */
export function resolveLayout(
  templateId: string | null | undefined,
  profileId: string | null | undefined,
  current: Partial<LayoutManifest> = {}
): LayoutManifest {
  const merged: LayoutManifest = { ...DEFAULT_MANIFEST, ...current }
  if (templateId) {
    const t = BY_TEMPLATE[templateId]
    if (t) Object.assign(merged, t)
  }
  if (profileId) {
    const p = BY_PROFILE[profileId]
    if (p) {
      // Dovolimo, da profil (dejavnostško) spremeni globlje stvari, ki jih
      // predloga sama ne postavi eksplicitno (npr. frizer vedno centered,
      // čebelar vedno products), da dejavnost ne sme biti vedno prepisana
      // s template orderom na napačno strukturo.
      if (!current.heroVariant) merged.heroVariant = p.heroVariant ?? merged.heroVariant
      if (!current.primary) merged.primary = p.primary ?? merged.primary
      merged.prominentCta = p.prominentCta ?? merged.prominentCta
      merged.showStats = p.showStats ?? merged.showStats
    }
  }
  return merged
}