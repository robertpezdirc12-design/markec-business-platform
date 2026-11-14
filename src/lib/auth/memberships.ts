// ============================================================
// #100 8.A (M1/M2) — ČLANSTVA (dvojno branje, brez brisanja)
// Avtoritativni vir = OrganizationMember vrstice; legacy
// User.organizationId/role ostane napovednik (M2 dual-read), dokler
// backfill ne pokrije vseh. Čisto jedro (normalizacija) je testabilno
// brez baze; pristopki DB so tanke ovojnice.
// ============================================================

import { prisma } from "@/lib/prisma"

export interface MembershipRef {
  organizationId: string
  role: string
  isDefault: boolean
}

/**
 * Normalizacija seznama članstev v aktivni org (čisto, testabilno):
 *  - če je trenutni (iz seje) med članstvi → ostane;
 *  - sicer prvo isDefault, sicer prvo po createdAt vrstnem redu podanega
 *    seznama (klicatelj poda ustrezno urejen seznam).
 *  - prazen seznam → null (klicatelj pade na legacy pot).
 */
export function normalizeActiveMembership(
  memberships: MembershipRef[],
  currentOrganizationId: string | null
): MembershipRef | null {
  if (memberships.length === 0) return null
  if (
    currentOrganizationId &&
    memberships.some((m) => m.organizationId === currentOrganizationId)
  ) {
    return (
      memberships.find((m) => m.organizationId === currentOrganizationId) ??
      null
    )
  }
  return memberships.find((m) => m.isDefault) ?? memberships[0]
}

/** Vsa članstva uporabnika (iz baze, sveže — pravice ne grejo če JWT). */
export async function getMembershipsForUser(
  userId: string
): Promise<MembershipRef[]> {
  const rows = await prisma.organizationMember.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { organizationId: true, role: true, isDefault: true },
  })
  return rows
}

/**
 * F2.0 — samo članstva v AKTIVNIH podjetjih.
 *
 * `getMembershipsForUser` ostane namerno BREZ statusnega filtra: akcija
 * preklopa ga uporablja kot dokaz članstva in nato sama preveri status
 * (memberships-100a.test.ts to jamči). Razreševalniki aktivnega konteksta
 * pa morajo uporabljati to različico — sicer se "aktiven" workspace lahko
 * veže na začasno ustavljeno podjetje, medtem ko tabla, števec in layout
 * prikazujejo izključno ACTIVE članstva (dokazana asimetrija F1).
 */
export async function getActiveMembershipsForUser(
  userId: string
): Promise<MembershipRef[]> {
  const rows = await prisma.organizationMember.findMany({
    where: { userId, organization: { status: "ACTIVE" } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { organizationId: true, role: true, isDefault: true },
  })
  return rows
}

/** Ali ima uporabnik sploh katero koli članstvo (tudi v neaktivnem orgu). */
export async function hasAnyMembership(userId: string): Promise<boolean> {
  const row = await prisma.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true },
  })
  return row !== null
}

/**
 * Čisto pravilo (brez baze): kdaj je legacy rezerva "prvo ACTIVE podjetje"
 * sploh dovoljena. Samo za pristne stare račune — brez članstev IN brez
 * povezave `User.organizationId`.
 */
export function legacyDefaultOrgAllowed(input: {
  hasMemberships: boolean
  legacyOrganizationId: string | null
}): boolean {
  return !input.hasMemberships && !input.legacyOrganizationId
}

/**
 * F2.0 — DB ovitek zgornjega pravila.
 *
 * Kdor IMA članstva (pa so vsa neaktivna ali kažejo na izbrisan org), ne
 * sme pasti na naključno TUJE podjetje: to je dokazano napačen kontekst
 * (nastavitve, terminologija in cilj akcij bi pripadali drugemu najemniku).
 * Hkrati ohranjamo dostop starim računom pred backfillom, ki nimajo nobene
 * OrganizationMember vrstice — "ne poruši upravičenih dostopov".
 * Javne poti (getPublicOrg / anonimni getResolvedOrg) tega ne uporabljajo.
 */
export async function mayUseLegacyDefaultOrg(
  userId: string,
  legacyOrganizationId: string | null
): Promise<boolean> {
  return legacyDefaultOrgAllowed({
    hasMemberships: await hasAnyMembership(userId),
    legacyOrganizationId,
  })
}

/**
 * M2 dvojno branje + F2.0 ACTIVE izolacija:
 *  - aktivna članstva → session org (če je med njimi), sicer isDefault,
 *    sicer prvo aktivno (zaščita proti starim JWT-jem),
 *  - članstva obstajajo, a nobeno ni ACTIVE → null (fail-closed; nikoli
 *    ne vrnemo ustavljenega org iz zastarele seje),
 *  - brez katerih koli članstev → legacy session org (stari računi pred
 *    backfillom delujejo nespremenjeno).
 */
export async function resolveActiveOrganizationId(
  userId: string,
  sessionOrganizationId: string | null
): Promise<string | null> {
  const memberships = await getActiveMembershipsForUser(userId)
  if (memberships.length > 0) {
    return (
      normalizeActiveMembership(memberships, sessionOrganizationId)
        ?.organizationId ?? null
    )
  }
  if (await hasAnyMembership(userId)) return null
  return sessionOrganizationId
}
