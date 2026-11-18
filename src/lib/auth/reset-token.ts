// P0 (audit 2026-11) — ŽETON ZA PONASTAVITEV GESLA: hashiranje na počivanju.
//
// Povabilni žetoni so bili od F2.2.1 shranjeni SAMO kot SHA-256 hash, žeton
// za ponastavitev gesla pa v čistini (`User.resetToken`). Kopija baze (ali
// poljuben SELECT) je tako pomenila prevzem kateregakoli računa — žeton je
// namreč edini dokaz za zamenjavo gesla. Zdaj velja isto pravilo za oba:
// surovi žeton pozna samo uporabnik (e-pošta), baza hrani hash.
//
// Prehodno stanje: žetoni, zapisani pred to spremembo, so v čistini. Iskanje
// zato poskusi NAJPREJ hash, nato (samo dokler obstajajo stare vrstice) tudi
// surovo vrednost; ob uspešni ponastavitvi se vrstica prepiše s hashom, torej
// stare vrstice se same »nadgradijo« ob prvi uporabi.
import { createHash, timingSafeEqual } from "node:crypto"

/** SHA-256 hash surovega žetona (hex) — to gre v bazo. */
export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

/** Primerjava v konstantnem času (prepreči timing oracle na žetonu). */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * Kandidati za iskanje po `User.resetToken`: najprej hash (novo stanje),
 * nato surovi žeton (vrstice, zapisane pred uvedbo hasha).
 */
export function resetTokenLookupValues(raw: string): string[] {
  // `Set` namesto `raw === hashed` — hash NIKOLI ni enak surovemu žetonu,
  // zato bi bila pogojna veja mrtva koda. Dedupe tako ostane resničen.
  return [...new Set([hashResetToken(raw), raw])]
}

/** Ali shranjena vrednost ustreza predloženemu surovemu žetonu? */
export function resetTokenMatches(stored: string | null, raw: string): boolean {
  if (!stored || !raw) return false
  return safeEqual(stored, hashResetToken(raw)) || safeEqual(stored, raw)
}
