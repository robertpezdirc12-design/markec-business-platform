// ============================================================
// F5.1 — JAVNA (tenant) VIDNOST AKTIVNIH PROMOCIJ
//
// Uporabi se za reklamno pasico na javni spletni strani (SaaS).
// Vrne le javno varno podmnožico podatkov aktivnih promocij
// (ime, opisni popust, kodo), nikoli interne ali nastavitvene.
// Deli isto "aktivno okno" kot admin/*checkout (engine.isWithinWindow):
// samo ACTIVE status + datumsko okno; izklopljene/DRAFT niso javno.
// ============================================================

import { prisma } from "@/lib/prisma"

export interface PublicActivePromotion {
  id: string
  name: string
  /** Berljiv opis popusta, npr. "-20 %" ali "-5,00 €". */
  discountLabel: string
  /** Null = samodejni popust (brez kode). */
  code: string | null
}

const eur = (n: number) =>
  n.toLocaleString("sl-SI", { style: "currency", currency: "EUR" })

/** Naloži javno vidne, trenutno veljavne promocije organizacije. */
export async function getPublicActivePromotions(
  orgId: string
): Promise<PublicActivePromotion[]> {
  const rows = await prisma.promotion.findMany({
    where: { organizationId: orgId, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      code: true,
      discountType: true,
      discountValue: true,
      startsAt: true,
      endsAt: true,
    },
  })

  const now = new Date()
  const out: PublicActivePromotion[] = []
  for (const p of rows) {
    // Enako okno kot v promocijskem motorju — ne pokaži načrtovanih/poteklih.
    if (p.startsAt && p.startsAt.getTime() > now.getTime()) continue
    if (p.endsAt && p.endsAt.getTime() < now.getTime()) continue

    const value = Number(p.discountValue)
    const discountLabel =
      p.discountType === "PERCENT"
        ? `-${Math.round(value)} %`
        : `-${eur(value)}`

    out.push({
      id: p.id,
      name: p.name,
      discountLabel,
      code: p.code,
    })
  }

  return out
}