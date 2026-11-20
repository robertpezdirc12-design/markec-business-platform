/**
 * FAZA 2 — Tipi za univerzalni sistem garancij in reklamacij (F2 §3).
 * Skupni model za vse profile; posebnosti po profilu (mehanik: čas+km,
 * šiviljstvo: 90 dni, čebelarstvo: zakonsko) so izražene prek privzetih
 * dolžin in dodatnih pravil v akcijah, podatkovno en model.
 */

// ============================================
// STATUS GARANCIJE
// ============================================
export type WarrantyStatus =
  | "ACTIVE"
  | "EXPIRING_SOON" // opozorilo pred potekom (npr. 30 dni)
  | "EXPIRED"
  | "CLAIMED" // aktivna reklamacija
  | "RESOLVED" // reklamacija rešena, garancija še lahko velja ali je zaključena
  | "REJECTED" // reklamacija zavrnjena

// ============================================
// PREDMET GARANCIJE
// ============================================
export type WarrantySubjectType = "PRODUCT" | "SERVICE" | "REPAIR"

// ============================================
// STATUS REKLAMACIJE
// ============================================
export type WarrantyClaimStatus = "PENDING" | "APPROVED" | "PARTIAL" | "REJECTED" | "RESOLVED"

/** Rezultat rešitve reklamacije. */
export type WarrantyClaimOutcome = "repair" | "replace" | "refund" | "rejected" | "credit_note"

// ============================================
// PROFIL-SPECIFIČNE PRIVZETE GARANCIJE (F2 §3.3)
// ============================================
export interface WarrantyProfileDefaults {
  profileId: string
  /** Privzeta dolžina v dnevih — kompenzirana s profilom, če 0 → zakonsko/brez. */
  periodDays: number
  /** Če nastavljeno (mehanika): garancija traja do validUntil MILEAGE, kar prej nastopi. */
  mileageLimitKm?: number
  /** Pravilo v naravnem jeziku (za UI), npr. "Samo na napake v izdelavi". */
  note: string
}

/**
 * Profilne privzete vrednosti za F2 §3.3 — vzdržuje se tukaj (profile id-ji
 * iz src/lib/verticals.ts: tire-service=mehanik/vulkanizer, seamstress=šiviljstvo,
 * beekeeping=čebelarstvo).
 * - mehanik (tire-service): 180 dni ALI 10.000 km (kar prej)
 * - šiviljstvo (seamstress): 90 dni (le napake v izdelavi)
 * - čebelarstvo (beekeeping): zakonsko jamstvo (2 leti), kakovost/varnost/teža
 * - oblačilna delavnica (apparel): 90 dni (le napake v izdelavi)
 * - tetovirni studio (tattoo-studio): 30 dni (popolnitev/barva)
 */
export const WARRANTY_PROFILE_DEFAULTS: WarrantyProfileDefaults[] = [
  {
    profileId: "tire-service",
    periodDays: 180,
    mileageLimitKm: 10000,
    note: "180 dni ali 10.000 km — kar nastopi prej.",
  },
  {
    profileId: "seamstress",
    periodDays: 90,
    note: "90 dni, le na napake v izdelavi; ne na spremembe mer po dostavi.",
  },
  {
    profileId: "beekeeping",
    periodDays: 365 * 2,
    note: "Zakonsko jamstvo (2 leti): kakovost, varnost, teža izdelka.",
  },
  {
    profileId: "apparel",
    periodDays: 90,
    note: "90 dni, le na napake v izdelavi; ne na spremembe mer po dostavi.",
  },
  {
    profileId: "tattoo-studio",
    periodDays: 30,
    note: "30 dni popravila/barve (popolnitev) brez doplačila.",
  },
]

/** Pomožni dostop do profilne privzete garancije (fallback: 90 dni). */
export function warrantyDefaultsForProfile(profileId: string): WarrantyProfileDefaults {
  return (
    WARRANTY_PROFILE_DEFAULTS.find((d) => d.profileId === profileId) ?? {
      profileId: "seamstress",
      periodDays: 90,
      note: "90 dni.",
    }
  )
}

// ============================================
// VRSTNI TIPI (vhod/izhod za akcije)
// ============================================
export interface WarrantyCreateInput {
  customerId: string
  subjectType: WarrantySubjectType
  subjectId: string
  documentId?: string
  validFrom?: string // ISO
  validUntil?: string // ISO (če okvir/measurement poda)
  warrantyPeriodDays?: number // če ni dano, profilna privzeta
  terms?: string
  notes?: string
}

export interface WarrantyClaimInput {
  warrantyId: string
  description: string
  receivedAt?: string // ISO
  assignedTo?: string
  status?: WarrantyClaimStatus
}

export interface WarrantyClaimUpdateInput {
  resolution?: string
  assignedTo?: string
  status?: WarrantyClaimStatus
  outcome?: WarrantyClaimOutcome
  notes?: string
}