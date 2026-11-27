// ============================================================
// GOOGLE KOLEDAR — SHRAMBA POVEZAVE (ena vrstica na najemnika)
//
// Vse, kar se dotika baze in žetonov, je TU — akcije in API poti
// ostanejo kratke in berljive. Žetoni se NIKOLI ne zapišejo v
// čistini: `encryptSecret` jih zavije v `enc:v1:…` (AES-256-GCM),
// ključ pa je v okolju, ne v bazi.
// ============================================================

import type { CalendarConnection } from "@prisma/client"
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets"
import { prisma } from "@/lib/prisma"
import {
  fetchAccountEmail,
  googleCalendarConfig,
  refreshAccessToken,
  type GoogleTokens,
} from "@/lib/calendar/google"

export interface CalendarStatus {
  /** Ali so strežniške poverilnice sploh nastavljene? */
  configured: boolean
  connected: boolean
  accountEmail: string | null
  calendarId: string | null
  connectedAt: string | null
  lastSyncAt: string | null
  lastSyncError: string | null
}

export const DISCONNECTED_STATUS: CalendarStatus = {
  configured: false,
  connected: false,
  accountEmail: null,
  calendarId: null,
  connectedAt: null,
  lastSyncAt: null,
  lastSyncError: null,
}

export function toStatus(connection: CalendarConnection | null): CalendarStatus {
  return {
    configured: googleCalendarConfig() !== null,
    connected: Boolean(connection),
    accountEmail: connection?.accountEmail ?? null,
    calendarId: connection?.calendarId ?? null,
    connectedAt: connection?.connectedAt.toISOString() ?? null,
    lastSyncAt: connection?.lastSyncAt?.toISOString() ?? null,
    lastSyncError: connection?.lastSyncError ?? null,
  }
}

export async function getConnection(organizationId: string): Promise<CalendarConnection | null> {
  return prisma.calendarConnection.findUnique({ where: { organizationId } })
}

/** Shrani (ali osveži) povezavo po uspešnem soglasju. */
export async function saveConnection(input: {
  organizationId: string
  tokens: GoogleTokens
  accountEmail: string | null
}): Promise<void> {
  const { organizationId, tokens, accountEmail } = input
  await prisma.calendarConnection.upsert({
    where: { organizationId },
    create: {
      organizationId,
      accessToken: encryptSecret(tokens.accessToken),
      refreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
      expiresAt: new Date(tokens.expiresAt),
      scope: tokens.scope,
      accountEmail,
      lastSyncError: null,
    },
    update: {
      accessToken: encryptSecret(tokens.accessToken),
      // Ob ponovnem soglasju Google vrne nov refresh žeton; če ga ne,
      // obdržimo starega (zato ga ne prepišemo z null).
      ...(tokens.refreshToken ? { refreshToken: encryptSecret(tokens.refreshToken) } : {}),
      expiresAt: new Date(tokens.expiresAt),
      scope: tokens.scope,
      accountEmail,
      lastSyncError: null,
    },
  })
}

/**
 * Prekini povezavo. Vrstica se BRIŠE (ne samo označi) — po prekinitvi
 * v bazi ne sme ostati noben žeton. Dogodki, ki so že v Googlu, tam
 * ostanejo: to je uporabnikov koledar in platforma jih ne sme brisati
 * brez njegove vednosti.
 */
export async function deleteConnection(organizationId: string): Promise<void> {
  await prisma.calendarConnection.deleteMany({ where: { organizationId } })
}

/**
 * Veljaven access žeton: če je potekel (ali poteče v minuti), ga
 * osvežimo IN shranimo. Vrne null, ko povezave ni več mogoče rešiti
 * (npr. uporabnik je dostop preklical v Googlu) — kličoči to prikaže
 * kot "povezava je potekla, poveži znova".
 */
export async function validAccessToken(connection: CalendarConnection): Promise<string | null> {
  const accessToken = decryptSecret(connection.accessToken)
  const refreshToken = decryptSecret(connection.refreshToken)
  const notExpired = connection.expiresAt ? connection.expiresAt.getTime() > Date.now() : false

  if (accessToken && notExpired) return accessToken
  if (!refreshToken) return null

  const refreshed = await refreshAccessToken(refreshToken)
  if (!refreshed.ok) {
    await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: { lastSyncError: refreshed.error },
    })
    return null
  }

  const email = connection.accountEmail ?? (await fetchAccountEmail(refreshed.value.accessToken))
  await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: encryptSecret(refreshed.value.accessToken),
      refreshToken: encryptSecret(refreshed.value.refreshToken ?? refreshToken),
      expiresAt: new Date(refreshed.value.expiresAt),
      accountEmail: email,
    },
  })
  return refreshed.value.accessToken
}

export async function recordSyncResult(
  organizationId: string,
  result: { error: string | null }
): Promise<void> {
  await prisma.calendarConnection.updateMany({
    where: { organizationId },
    data: result.error
      ? { lastSyncError: result.error }
      : { lastSyncAt: new Date(), lastSyncError: null },
  })
}
