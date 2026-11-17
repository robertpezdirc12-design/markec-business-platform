// ============================================================
// NADOMESTNE SLIKE KARTIC — ločen modul BREZ snapshot JSON-a.
//
// Zakaj ločeno: BusinessShowcase je client komponenta. Če bi uvozila
// pomočnik iz snapshot.ts, bi se celoten marketplace JSON (do 500
// podjetij) znašel v client bundlu. Ta modul je čist in majhen.
// ============================================================

/**
 * Nadomestna slika kartice po dejavnosti.
 *
 * Audit 2026-11-17: vse kartice brez logotipa so kazale ISTO splošno
 * sliko (in ta pot ni obstajala → 404). Izbira sledi VERTICAL_IMAGERY v
 * src/lib/verticals.ts, da je vizualna identiteta dejavnosti usklajena.
 */
const VERTICAL_CARD_IMAGE: Record<string, string> = {
  barber: "/img/presets/hero-barber.jpg",
  frizer: "/img/presets/hero-barber.jpg",
  massage: "/img/presets/hero-spa.jpg",
  kozmetika: "/img/presets/hero-spa.jpg",
  epilation: "/img/presets/hero-laser.jpg",
  seamstress: "/img/presets/hero-atelier.jpg",
  "tire-service": "/img/presets/hero-garage.jpg",
  mehanik: "/img/presets/hero-garage.jpg",
  beekeeping: "/img/presets/hero-apiary.jpg",
  generic: "/img/presets/hero-workspace.jpg",
}

/** Nevtralna rezerva, ko dejavnost ni znana (datoteka obstaja). */
export const DEFAULT_CARD_IMAGE = "/img/presets/hero-workspace.jpg"

/** Vse poti, ki jih kartice lahko uporabijo (za test obstoja datotek). */
export const CARD_IMAGE_PATHS = [
  ...new Set([...Object.values(VERTICAL_CARD_IMAGE), DEFAULT_CARD_IMAGE]),
]

export function verticalCardImage(vertical?: string | null): string {
  if (!vertical) return DEFAULT_CARD_IMAGE
  return VERTICAL_CARD_IMAGE[vertical] ?? DEFAULT_CARD_IMAGE
}
