// ============================================================
// F5.0 — SKD 2025 → poslovni profil preslikava.
//
// Za vsak konkretni podrazred (raven 5) določimo ustrezen poslovni
// profil (36 obstoječih iz src/lib/profiles/registry.ts). Pravilo je
// deterministično in pregledno:
//
//   1. SECTION default — vsaka sekcija (A–V) ima svoj `skd-*` profil;
//   2. DIVISION override — kjer določen oddelek občutno bolj sodi drugam
//      (npr. popravila motornih vozil -> mehanik);
//   3. SUBCLASS override — kjer točno določen podrazred ima "ročno"
//      izdelan profil (frizer, beauty, nails, …).
//
// `resolveSkdProfile(code)` hodi hiearhijo podrazred→razred→skupina→
// oddelek→sekcija in vrne prvi veljaven profil. Na koncu vedno pade na
// SEKCIJSKI profil (nikoli ne pusti dejavnosti brez izhodišča). Kjer
// noben obstoječi profil ni zares ustrezen, uporabimo generični/
// sekcijski profil in zabeležimo potrebo (SKD_PROFILE_EXCEPTIONES).
//
// Client-safe: brez prisma, brez server-only.
// ============================================================

import { getProfile } from "@/lib/profiles/registry"
import type { ActivityProfile } from "@/lib/profiles/types"
import { isSkdCatalogCode } from "@/lib/skd/data/skd-codes"

// ------------------------------------------------------------
// 1. Sekcija A–V -> profil (najboljša privzeta raven).
//    Ujemanje s skd-* profili v registry.ts.
// ------------------------------------------------------------
const SECTION_PROFILE: Record<string, string> = {
  A: "skd-a-agriculture",
  B: "skd-b-mining",
  C: "skd-c-manufacturing",
  D: "skd-d-energy",
  E: "skd-e-water-waste",
  F: "skd-f-construction",
  G: "skd-g-retail",
  H: "skd-h-transport",
  I: "skd-i-hospitality",
  J: "skd-j-media",
  K: "skd-k-digital",
  L: "skd-l-finance",
  M: "skd-m-real-estate",
  N: "skd-n-professional",
  O: "skd-o-other-business",
  P: "skd-p-public-admin",
  Q: "skd-q-education",
  R: "skd-r-health",
  S: "skd-s-culture-sport",
  T: "skd-t-other",
  U: "skd-u-households",
  V: "skd-v-international",
}

// ------------------------------------------------------------
// 2. Oddelek (raven 2) -> bolj specifičen "ročni" profil.
//    Samo kjer je razlika dejansko poslovno smiselna; drugače pustimo
//    sekcijski default (nil = bodi zvest sekciji).
// ------------------------------------------------------------
const DIVISION_PROFILE: Record<string, string> = {
  // Poslovne storitve za končne uporabnike, kjer je "storitveni" profil z
  // delovnimi nalogi pravi ekvivalent.
  // (privzeto skd-* je že smiselno za veliko večino; tu le redke izjeme.)

  // --- Proizvodnja oblačil (sekcija C) -> apparel ---
  // C14 zajema krojenje po meri in serijsko proizvodnjo — delovni proces
  // z meritvami, predračuni in serijami; širše od profila seamstress,
  // ki pokriva samo popravila/spremembe po meri.
  "C14": "apparel",
}

// ------------------------------------------------------------
// 3. Konkretni podrazred / razred -> "ročni" profil.
//    Najvišja prednost pred sekcijskim defaultom.
// ------------------------------------------------------------
const SUBCLASS_PROFILE: Record<string, string> = {
  // --- Lepota in osebna nega (sekcija T) ---
  "T96.210": "frizer", // frizerska in brivska
  "T96.220": "beauty", // kozmetična in pedikerska (manikira/pedikira/lepota)
  "T96.230": "massage", // savne in parne kopeli (wellness) -> masaŽni profil
  "T96.991": "tattoo-studio", // tetoviranje in pirsing — sterilni obrtniški studio

  // --- Popravila motornih vozil (sekcija T) -> mehanik ---
  "T95.310": "mehanik", // popravila in vzdrževanje motornih vozil
  "T95.320": "mehanik", // motorna kolesa

  // --- Kmetijstvo -> beekeeping za poljedeljske/čebelarske niše ni
  //     samostojnega podrazreda; sekcija A je že preslika beekeeping katalog. ---

  // --- Šivanje / krojenje po meri (sekcija C) -> apparel ---
  // Krojenje po meri in serijska proizvodnja oblačil (C14) dobita
  // profil apparel prek DIVISION_PROFILE (gibanje navzgor po hierarhiji).
}

// ------------------------------------------------------------
// 4. Izjeme / evidentirana potreba po novem profilu ali modulu.
//    To SO podrazredi, ki dobijo delujoč izhodiščni sistem (sekcijski/
//    generični profil), a se zanje priporoča nov ali izboljšan profil.
// ------------------------------------------------------------
export interface SkdProfileException {
  /** Konkretni podrazred (raven 5) ali razred (raven 4). */
  code: string
  /** Sekcijski/generični profil, ki se dejansko uporabi. */
  usedProfile: string
  /** Zakaj ni boljšega profila in kaj bi novi profil dodal. */
  reason: string
  /** Predlagan novi profil id (ni še izdelan). */
  suggestedProfile: string
}

export const SKD_PROFILE_EXCEPTIONS: SkdProfileException[] = [
  {
    code: "S92.0",
    usedProfile: "skd-s-culture-sport",
    reason:
      "Prirejanje iger na srečo (S92.001–S92.009, vklj. stavne urednike in kockarnice) — licencirana dejavnost z regulatorno evidence (stave, izplačila, omejitve) in brez poslovnega kataloga; trenutno deluje v skd-s izhodišču, novi profil bi dodal evidenco stav in izplačil.",
    suggestedProfile: "gambling",
  },
]

// ------------------------------------------------------------
// 5. Razreševalnik
// ------------------------------------------------------------
function sectionOf(code: string): string | null {
  return code.length >= 1 ? code[0] : null
}

/**
 * Edini razreševalnik vsebuje logiko in deterministični `source`:
 * `resolveSkdProfileInfo` je AVTORITATIVEN. `resolveSkdProfile` je zgoj
 * tanek ovoj nad njim (vrne profil), da se preslikav in preverb ne vzdržuje
 * na dveh različnih mestih — nikakor se ne podvaja.
 */
export function resolveSkdProfile(code: string): ActivityProfile {
  return resolveSkdProfileInfo(code).profile
}

/** Kako je concrete podrazred razrešen (F5.0 §2) — enoten, preverljiv izvor. */
export type SkdMappingSource =
  | "subclass-override" // SUBCLASS_PROFILE — točen podrazred
  | "division-override" // DIVISION_PROFILE — oddelek (raven 2)
  | "section-default" // SECTION_PROFILE — sekcijski privzetek (raven 1)
  | "generic-fallback" // generični profil (zadnja rezerva)

export interface ResolvedSkdProfile {
  profile: ActivityProfile
  /** Determinističen način preslikave (tabela je TU, ne v kopijah). */
  source: SkdMappingSource
  /** Oddelek (raven 2), ki je sprožil override — samo za division-override. */
  division: string | null
  /** Kje v predlogi živi uporabljeni profil. */
  profileId: string
}

/** Ali je šifra DEJANSKO uradna koda v katalogu SKD 2025 (katerakoli raven 1–5). */
/**
 * O(1) veljavnostna preverba po katalogu — uporablja lahki `skd-codes` modul
 * (samo 1725 kod, brez imen), NE pa celotne `skd2025.ts` datoteke (~268 KB z
 * uradnimi slovenskimi/angleškimi imeni). Tako client-safe `profiles.ts` ne
 * potegne celotnega kataloga v začetni brskalniški bundle.
 * NE zadošča oblikovna ustreznost (npr. "T99.999" je videzno pravilna, a NI v
 * katalogu). Poštenost: neobstoječa koda ne sme tiho dobiti sekcijskega profila
 * in biti predstavljena kot veljavna dejavnost.
 */
export function isValidSkdCode(code: string): boolean {
  return isSkdCatalogCode(code.trim().toUpperCase())
}

/**
 * Kakšen je status veljavnosti za dani vnos — za poročila/teste. Loči:
 * - "valid"    : uradna koda v katalogu (raven 1–5);
 * - "unknown"  : ni v katalogu (ne sme dobiti sekcijskega profila);
 * - "empty"    : prazen vnos.
 */
export type SkdCodeValidity = "valid" | "unknown" | "empty"

export function skdCodeValidity(code: string): SkdCodeValidity {
  const c = code.trim()
  if (c.length === 0) return "empty"
  return isSkdCatalogCode(c.toUpperCase()) ? "valid" : "unknown"
}

/**
 * Kot `resolveSkdProfile`, a vrne tudi deterministični izvor preslikave.
 * Isto logicno jedro kot resolver — nobena druga koda ne vzdržuje teh
 * tabel; `source` je izpeljan iz istega zaporedja preverb.
 */
export function resolveSkdProfileInfo(code: string): ResolvedSkdProfile {
  const c = code.trim().toUpperCase()
  // KATALOŠKI PRAG pred vsemi prevlečki (F5.0 §2). Šifra mora biti DEJANSKO
  // uradna koda v katalogu SKD 2025, preden se sploh upošteva kakršen koli
  // subclass/division/section prevleček. Neobstoječa, a oblikovno varljiva koda
  // (npr. "C14.999" ali "T99.999") se nikoli ne sme razrešiti na realen profil
  // prek ujemanja predpone (DIVISION_PROFILE["C14"]) — vedno pade na
  // generic-fallback.
  if (!isSkdCatalogCode(c)) {
    const profile = getProfile("generic")
    return { profile, profileId: profile.id, source: "generic-fallback", division: null }
  }
  if (SUBCLASS_PROFILE[c]) {
    const profile = getProfile(SUBCLASS_PROFILE[c])
    return { profile, profileId: profile.id, source: "subclass-override", division: null }
  }
  let probe = c
  while (probe.includes(".")) {
    const i = probe.lastIndexOf(".")
    probe = probe.slice(0, i)
    if (DIVISION_PROFILE[probe]) {
      const profile = getProfile(DIVISION_PROFILE[probe])
      return { profile, profileId: profile.id, source: "division-override", division: probe }
    }
  }
  if (DIVISION_PROFILE[probe]) {
    const profile = getProfile(DIVISION_PROFILE[probe])
    return { profile, profileId: profile.id, source: "division-override", division: probe }
  }
  // Sem pridejo le katalogirane kode (prag zgoraj), zato je sekcijski privzetek
  // vedno veljaven za pravo sekcijo A–V.
  const sec = sectionOf(c)
  if (sec && SECTION_PROFILE[sec]) {
    const profile = getProfile(SECTION_PROFILE[sec])
    return { profile, profileId: profile.id, source: "section-default", division: null }
  }
  const profile = getProfile("generic")
  return { profile, profileId: profile.id, source: "generic-fallback", division: null }
}

/**
 * Ali podrazred uporablja profil z zapisano izjemo (F5.0 §2).
 * Pošteno: izjema se prizna SAMO za dejansko katalogirano kodo — ne za
 * neobstoječo šifro, ki bi se ujemala samo po predponi (npr. "S92.099" ni v
 * katalogu in NI igra na srečo, čeprav se začne s "S92.0").
 */
export function isSkdException(code: string): boolean {
  const c = code.trim().toUpperCase()
  if (!isSkdCatalogCode(c)) return false
  return SKD_PROFILE_EXCEPTIONS.some(
    (e) => e.code === c || c.startsWith(e.code)
  )
}

/** Podatkovna tabela za poročilo — števec profilov po preslikavi. */
export function profileIdForSkd(code: string): string {
  return resolveSkdProfile(code).id
}