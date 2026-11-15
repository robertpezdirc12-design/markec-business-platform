/**
 * FAZA 2 — čista logika garancij (brez server/network odvisnosti).
 * Ločena od `src/app/actions/warranties.ts`, da jo je mogoče enostavno
 * enotno testirati (vitest) in ponovno uporabiti na več mestih.
 */
import type { WarrantyStatus } from "@/lib/types/warranty"

/** Število dni pred potekom, ko se status preklopi v EXPIRING_SOON. */
export const EXPIRING_SOON_WINDOW_DAYS = 30

/**
 * Izračuna dejanski status iz podatkov (datum + mileage za mehaniko).
 * mileageLimitKm prepozna "kar nastopi prej" (čas ali prevožena razdalja).
 */
export function computeWarrantyStatus(input: {
  validUntil: Date | null
  validUntilMileage: number | null
  /** trenutno zabeležena prevožena km (0 če ni podatka) */
  currentMileageKm: number | null
  declared: string
  hasOpenClaim: boolean
  now?: Date
}): WarrantyStatus {
  const now = input.now ?? new Date()
  // Reklamacija v teku ima svoj vtis — ne prezremo je zaradi datuma.
  if (input.hasOpenClaim) return "CLAIMED"
  if (input.declared !== "ACTIVE") return input.declared as WarrantyStatus

  let expired = false
  if (input.validUntil && input.validUntil < now) expired = true
  // Mehanika: garancija poteče tudi, če je dosežena kilometrina (kar prej).
  if (input.validUntilMileage != null && input.currentMileageKm != null && input.currentMileageKm >= input.validUntilMileage) {
    expired = true
  }
  if (expired) return "EXPIRED"

  // EXPIRING_SOON samo, če ostane manj kot okno dni (in ni kilometlo neomejeno).
  if (input.validUntil && input.validUntil.getTime() - now.getTime() < EXPIRING_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
    return "EXPIRING_SOON"
  }
  return "ACTIVE"
}