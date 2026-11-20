// ============================================================
// KATEGORIJSKI POIZVEDBENI TERMINI TRŽNICE — za /podjetja.
//
// Marketplace pills (domača stran in /podjetja hero) uporabljajo človeške
// oznake dejavnosti, snapshot pa hrani id dejavnosti (tip). Zemljevid spodaj
// preslika javno oznako v iskalni termin, ki razume novi filter (`frizer`), 
// ali fragment (`kozmet`), ki ujame `kozmetika` itd.
//
// #case-fix: ujemanje je case-insensitive — obiskovalec lahko v URL pripelje
// "Frizerski Saloni" (velika črka) in vseeno dobi prave rezultate namesto
// prazne strani "0 podjetij". Ključi so shranjeni lower-case, lookup pa
// normalizira vhod z .toLowerCase().
// ============================================================

export const CATEGORY_QUERY: Record<string, string> = {
  "frizerski saloni": "frizer",
  kozmetika: "kozmet",
  masaža: "masaž",
  brivci: "briv",
  nohti: "noht",
  wellness: "wellness",
}

/** Preslika javno oznako kategorije v iskalni termin, case-insensitive. */
export function resolveCategoryQuery(query: string): string {
  const trimmed = query.trim()
  return CATEGORY_QUERY[trimmed] ?? CATEGORY_QUERY[trimmed.toLowerCase()] ?? trimmed
}