// ============================================================
// F5.5.4.1 — ŠTEVILČENJE DOKUMENTOV (org + tip + poslovno leto).
//
// Zaporedna serija `DocumentSequence` se zaklene z `FOR UPDATE` znotraj
// transakcije, zato vzporedni zahtevki nikoli ne dobijo iste številke.
// Serija se po potrebi inicializira iz obstoječih dokumentov (max+1),
// tako se ohranijo vse obstoječe številke.
// ============================================================

import type { Prisma } from "@prisma/client"

type Tx = Prisma.TransactionClient

export type DocType = "QUOTE" | "INVOICE" | "ADVANCE" | "CREDIT"

export function fiscalYearOf(date: Date): number {
  return date.getFullYear()
}

/**
 * Vzame naslednjo številko za (org, type, fiscalYear). ATOMSKO prek
 * `upsert` (INSERT … ON CONFLICT) — vzporedni klici se serijalizirajo na
 * ravni vrstice, zato nikoli ne dobijo iste številke. MORA se klicati
 * znotraj interaktivne transakcije (skupaj z ustvarjanjem dokumenta).
 */
export async function nextDocumentNumber(
  tx: Tx,
  organizationId: string,
  type: DocType,
  fiscalYear: number
): Promise<number> {
  // Če serija še ne obstaja, jo inicializiramo iz obstoječih dokumentov
  // (max+1) — tako se ohranijo vse obstoječe številke.
  const agg = await tx.document.aggregate({
    where: { organizationId, type, fiscalYear },
    _max: { number: true },
  })
  const seed = (agg._max.number ?? 0) + 1

  const row = await tx.documentSequence.upsert({
    where: { organizationId_type_fiscalYear: { organizationId, type, fiscalYear } },
    create: { organizationId, type, fiscalYear, current: seed },
    update: { current: { increment: 1 } },
  })
  return row.current
}

/** Dokumentna oznaka (RAC-0001 / PON-0001 / AVN-0001 / DN-0001) — za prikaz. */
export function docNumberLabel(type: DocType, fiscalYear: number, number: number): string {
  const prefix = type === "QUOTE" ? "PON" : type === "CREDIT" ? "DN" : type === "ADVANCE" ? "AVN" : "RAC"
  const yearSuffix = fiscalYear ? `/${fiscalYear}` : ""
  return `${prefix}-${String(number).padStart(4, "0")}${yearSuffix}`
}