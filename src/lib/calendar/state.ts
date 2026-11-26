// ============================================================
// GOOGLE KOLEDAR — PODPISAN `state` PARAMETER (CSRF zaščita OAuth toka)
//
// Zakaj: callback je navaden GET, ki ga lahko sproži kdorkoli. Brez
// podpisanega state-a bi napadalec lahko prijavljenemu lastniku
// podtaknil SVOJ `code` in v njegov račun povezal TUJ koledar (ali
// obratno). State veže zahtevo na organizacijo + uporabnika in poteče,
// zato je ukraden/ponovno uporabljen `code` neuporaben.
//
// Format: `v1.<base64url(payload)>.<base64url(hmac)>`. Podpis je
// HMAC-SHA256, ključ iz okolja (nikoli iz baze). Modul je NAMERNO brez
// Prisma/Next odvisnosti, da je testabilen kot čista funkcija.
// ============================================================

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

const PREFIX = "v1"

/** Piškotek, ki veže OAuth zahtevo na TA brskalnik. */
export const STATE_COOKIE = "markec_calendar_state"
/** State velja 10 minut — dovolj za prijavo v Google, prekratko za zlorabo. */
export const STATE_TTL_MS = 10 * 60 * 1000

export interface CalendarStatePayload {
  /** Organizacija, ki povezavo začenja. */
  org: string
  /** Uporabnik, ki je kliknil "Poveži" (povratna sled v dnevniku). */
  user: string
  /** Potek v epoch ms. */
  exp: number
  /** Naključna vrednost — onemogoča napovedovanje zaporednih state-ov. */
  nonce: string
}

/** Ključ za podpis state-a: namenski, sicer obstoječi strežniški ključi. */
function stateSecret(): string | null {
  const raw =
    process.env.CALENDAR_STATE_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.SECRETS_ENCRYPTION_KEY?.trim()
  return raw && raw.length >= 16 ? raw : null
}

export function calendarStateConfigured(): boolean {
  return stateSecret() !== null
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function sign(payloadB64: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(`${PREFIX}.${payloadB64}`).digest())
}

export function createState(
  input: { org: string; user: string },
  now: number = Date.now()
): string {
  const secret = stateSecret()
  if (!secret) throw new Error("CALENDAR_STATE_SECRET (ali NEXTAUTH_SECRET) ni nastavljen.")
  const payload: CalendarStatePayload = {
    org: input.org,
    user: input.user,
    exp: now + STATE_TTL_MS,
    nonce: randomBytes(12).toString("base64url"),
  }
  const payloadB64 = b64url(JSON.stringify(payload))
  return `${PREFIX}.${payloadB64}.${sign(payloadB64, secret)}`
}

/**
 * Preveri podpis in potek. Vrne payload ali `null` — nikoli ne vrže,
 * ker je to vhod od zunaj (callback lahko pokliče kdorkoli).
 */
export function verifyState(token: string | null, now: number = Date.now()): CalendarStatePayload | null {
  if (!token) return null
  const secret = stateSecret()
  if (!secret) return null
  const parts = token.split(".")
  if (parts.length !== 3 || parts[0] !== PREFIX) return null
  const [, payloadB64, signature] = parts
  if (!payloadB64 || !signature) return null

  const expected = sign(payloadB64, secret)
  // Dolžini morata sovpadati, sicer timingSafeEqual vrže.
  if (expected.length !== signature.length) return null
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null
  } catch {
    return null
  }

  let payload: CalendarStatePayload
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8")) as CalendarStatePayload
  } catch {
    return null
  }
  if (!payload || typeof payload.org !== "string" || typeof payload.user !== "string") return null
  if (typeof payload.exp !== "number" || payload.exp <= now) return null
  return payload
}
