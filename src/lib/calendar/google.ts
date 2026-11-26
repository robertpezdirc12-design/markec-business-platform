// ============================================================
// GOOGLE KOLEDAR — OMREŽNI SLOJ (OAuth + Calendar API)
//
// Namenoma BREZ paketa `googleapis` (~50 MB, Node-only): uporabljamo
// kar `fetch` na uradne REST točke. Tako modul dela tudi v okolju
// Cloudflare Workers (kamor se aplikacija objavlja) in ne poveča
// hladnega zagona.
//
// Poverilnice (client id/secret) so STREŽNIŠKE — nikoli v komponento.
// Če niso nastavljene, `googleCalendarConfig()` vrne null in kartica
// v nastavitvah to pošteno pove ("Ni nastavljeno"), namesto da bi
// ponujala gumb, ki ne more delovati.
// ============================================================

import { resolveAppUrl } from "@/lib/seo"

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
const CALENDAR_API = "https://www.googleapis.com/calendar/v3"

/**
 * Dostop do koledarja: `calendar.events` zadošča za branje/pisanje
 * dogodkov in je ožji od `calendar` (ki bi dovolil tudi brisanje
 * celotnih koledarjev). `openid email` potrebujemo le zato, da
 * lastniku pokažemo, KATERI Google račun je povezan.
 */
export const CALENDAR_SCOPE = [
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
].join(" ")

export interface GoogleCalendarConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

/**
 * Konfiguracija: namenski par `GOOGLE_CALENDAR_CLIENT_ID/SECRET`, sicer
 * obstoječi prijavni par `AUTH_GOOGLE_*` (isti OAuth odjemalec lahko
 * služi obema namenoma — le redirect URI je treba dodati v Google Cloud).
 */
export function googleCalendarConfig(): GoogleCalendarConfig | null {
  const clientId =
    process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() || process.env.AUTH_GOOGLE_ID?.trim()
  const clientSecret =
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() || process.env.AUTH_GOOGLE_SECRET?.trim()
  if (!clientId || !clientSecret) return null
  return {
    clientId,
    clientSecret,
    redirectUri: `${resolveAppUrl()}/api/integrations/google/calendar/callback`,
  }
}

export function googleCalendarConfigured(): boolean {
  return googleCalendarConfig() !== null
}

/** URL soglasja. `prompt=consent` je nujen, da dobimo refresh_token. */
export function buildAuthUrl(state: string): string | null {
  const config = googleCalendarConfig()
  if (!config) return null
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

export interface GoogleTokens {
  accessToken: string
  refreshToken: string | null
  /** Epoch ms, ko access žeton poteče. */
  expiresAt: number
  scope: string | null
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

function tokenResult(json: {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
}): Result<GoogleTokens> {
  if (!json.access_token) return { ok: false, error: "Google ni vrnil dostopnega žetona." }
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600
  return {
    ok: true,
    value: {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      // 60 s rezerve: žeton, ki poteče med pošiljanjem, je isto kot potekel.
      expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
      scope: json.scope ?? null,
    },
  }
}

async function postToken(body: Record<string, string>): Promise<Result<GoogleTokens>> {
  let response: Response
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
      cache: "no-store",
    })
  } catch {
    return { ok: false, error: "Google ni dosegljiv (omrežna napaka)." }
  }
  const json = (await response.json().catch(() => ({}))) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string
    error?: string
    error_description?: string
  }
  if (!response.ok) {
    const detail = json.error_description || json.error || String(response.status)
    return { ok: false, error: `Google je zavrnil zahtevo: ${detail}` }
  }
  return tokenResult(json)
}

/** Zamenjava `code` za žetone (callback). */
export async function exchangeCode(code: string): Promise<Result<GoogleTokens>> {
  const config = googleCalendarConfig()
  if (!config) return { ok: false, error: "Google Calendar ni nastavljen na strežniku." }
  return postToken({
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  })
}

/** Osvežitev access žetona z refresh žetonom. */
export async function refreshAccessToken(refreshToken: string): Promise<Result<GoogleTokens>> {
  const config = googleCalendarConfig()
  if (!config) return { ok: false, error: "Google Calendar ni nastavljen na strežniku." }
  const result = await postToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })
  if (!result.ok) return result
  // Google ob osvežitvi NE vrne novega refresh žetona — obdržimo starega.
  return { ok: true, value: { ...result.value, refreshToken: result.value.refreshToken ?? refreshToken } }
}

/** Kateri Google račun je povezan (za povratno informacijo v UI). */
export async function fetchAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    })
    if (!response.ok) return null
    const json = (await response.json()) as { email?: string }
    return json.email ?? null
  } catch {
    return null
  }
}

async function calendarRequest(
  accessToken: string,
  path: string,
  init: { method: string; body?: unknown }
): Promise<Result<Record<string, unknown>>> {
  let response: Response
  try {
    response = await fetch(`${CALENDAR_API}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    })
  } catch {
    return { ok: false, error: "Googlov koledar ni dosegljiv (omrežna napaka)." }
  }
  if (response.status === 410 || response.status === 404) {
    // Dogodek je bil v Googlu izbrisan — to ni napaka, ampak stanje,
    // ki ga kličoči obravnava kot "ponovno ustvari".
    return { ok: false, error: "gone" }
  }
  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
    return { ok: false, error: json.error?.message || `Google Calendar: HTTP ${response.status}` }
  }
  if (response.status === 204) return { ok: true, value: {} }
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: true, value: json }
}

function eventsPath(calendarId: string): string {
  return `/calendars/${encodeURIComponent(calendarId)}/events`
}

export async function createEvent(
  accessToken: string,
  calendarId: string,
  body: unknown
): Promise<Result<{ id: string }>> {
  const result = await calendarRequest(accessToken, `${eventsPath(calendarId)}?sendUpdates=none`, {
    method: "POST",
    body,
  })
  if (!result.ok) return result
  const id = typeof result.value.id === "string" ? result.value.id : null
  if (!id) return { ok: false, error: "Google ni vrnil id-ja dogodka." }
  return { ok: true, value: { id } }
}

export async function updateEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  body: unknown
): Promise<Result<{ id: string }>> {
  const result = await calendarRequest(
    accessToken,
    `${eventsPath(calendarId)}/${encodeURIComponent(eventId)}?sendUpdates=none`,
    { method: "PATCH", body }
  )
  if (!result.ok) return result
  const id = typeof result.value.id === "string" ? result.value.id : eventId
  return { ok: true, value: { id } }
}

export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<Result<{ deleted: boolean }>> {
  const result = await calendarRequest(
    accessToken,
    `${eventsPath(calendarId)}/${encodeURIComponent(eventId)}?sendUpdates=none`,
    { method: "DELETE" }
  )
  if (!result.ok) {
    // Že izbrisan dogodek = želeno stanje doseženo.
    if (result.error === "gone") return { ok: true, value: { deleted: false } }
    return result
  }
  return { ok: true, value: { deleted: true } }
}

/** Preveri obstoj dogodka (uporablja se ob "gone" pri PATCH-u). */
export async function getEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<Result<{ id: string; summary?: string; start?: { dateTime?: string }; end?: { dateTime?: string } }>> {
  const result = await calendarRequest(
    accessToken,
    `${eventsPath(calendarId)}/${encodeURIComponent(eventId)}`,
    { method: "GET" }
  )
  if (!result.ok) return result
  const value = result.value as {
    id?: string
    summary?: string
    start?: { dateTime?: string }
    end?: { dateTime?: string }
  }
  return { ok: true, value: { id: value.id ?? eventId, summary: value.summary, start: value.start, end: value.end } }
}
