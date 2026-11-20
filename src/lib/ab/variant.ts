// ============================================================
// A/B varianta booking forme (runtime //xeno namesto NEXT_PUBLIC).
// Varianta se določi na SERVERJU v RSC (page) po request-u, NE ob
// build (NEXT_PUBLIC bi bila zamrznjena inline). Posledično jo lahko
// lastnik zamenja ob živo (sprememba env + deploy) in tako meri.
// Za prav A/B razdelitev: če `BOOKING_AB_VARIANT` ni nastavljen, se
// razdeli deterministično 50/50 po org (vsak najemnik konzistentno v
// svoji grupi).
// ============================================================

import { createHash } from "node:crypto"

export type BookingABVariant = "short" | "full"

/** Server-side (RSC-safe): določi varianto za trenutno organizacijo. */
export async function getBookingABVariant(orgKey?: string): Promise<BookingABVariant> {
  const forced = process.env.BOOKING_AB_VARIANT
  if (forced === "short") return "short"
  if (forced === "full" || forced === "control") return "full"

  // Deterministična 50/50 razdelitev po org — konzistna za celo organizacijo.
  const seed = orgKey ?? "global"
  const digest = createHash("md5").update(seed).digest("hex")
  return parseInt(digest.slice(0, 8), 16) % 2 === 1 ? "short" : "full"
}