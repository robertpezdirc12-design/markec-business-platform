// ============================================================
// DATA-INTEGRITY AUDIT — READ-ONLY (P0 #131)
//
// Lahki, read-only inventurni SELECTi, ki na dani organizaciji
// poiščejo finančne/poslovne nedoslednosti. Funkcija NIKOLI ne piše
// v bazo — samo beri (SELECT/$queryRaw reading). Namen: revizija
// tenant izolacije, osirotelih zapisov in plačilnih relacij brez
// posega v podatke.
//
// Vsak check je vezan na organizationId parametru, zato preverja
// izključno zapise tega tenanta (vse relacije morajo ostati znotraj
// iste org — cross-org "uhajanje" se šteje za kršitev).
// ============================================================

import { prisma } from "@/lib/prisma"

export type IntegrityIssue = {
  /** Tipologija (mapira na SELECT check spodaj). */
  kind:
    | "payment-org-mismatch"
    | "advance-org-mismatch"
    | "duplicate-cleared-payment-reference"
    | "multiple-active-advance-allocation"
    | "orphan-order-item"
    | "orphan-appointment-service"
  /** Id zapisa, ki krši pravilo. */
  recordId: string
  /** Človeku berljiv opis v slovenščini. */
  detailSl: string
}

/**
 * Read-only inventura nekonzistentnosti za eno organizacijo.
 *
 * @param organizationId  tenant-scope filter — preverjajo se SAMO zapisi
 *                        tega tenanta; relacije, ki kažejo ven iz njega,
 *                        se označijo kot kršitev.
 * @returns  seznam odkritih kršitev (prazno = čisto).
 */
export async function auditOrganizationIntegrity(
  organizationId: string
): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = []

  // ---- 1. DocumentPayment.organizationId === organizationId dokumenta ----
  // Napačno vezano plačilo je znak cross-tenant alokacije ali napačnega
  // zapisa. Vežemo se na DOKUMENTE te org in preverimo, da vsa pripadajoča
  // plačila nosijo isto org — tako ujamemo tudi plačilo, ki je bilo pomotoma
  // zapisano pod drugo org (in bi ga filtr po payment.org preskočil).
  const paymentOrgMismatch = await prisma.$queryRaw<{ id: string; paymentOrg: string; docOrg: string }[]>`
    SELECT p."id", p."organizationId" AS "paymentOrg", d."organizationId" AS "docOrg"
    FROM "DocumentPayment" p
    JOIN "Document" d ON d."id" = p."documentId"
    WHERE d."organizationId" = ${organizationId}
      AND p."organizationId" <> d."organizationId"
    LIMIT 50`
  for (const row of paymentOrgMismatch) {
    issues.push({
      kind: "payment-org-mismatch",
      recordId: row.id,
      detailSl: `Plačilo je vezano na org ${row.paymentOrg}, dokument pa na org ${row.docOrg}.`,
    })
  }

  // ---- 2. DocumentAdvanceAllocation.organizationId === org obeh dokumentov ----
  // Predujemska alokacija mora biti znotraj iste org za advance in invoice. a
  const advanceOrgMismatch = await prisma.$queryRaw<
    { id: string; alloOrg: string; advOrg: string; invOrg: string }[]
  >`
    SELECT a."id", a."organizationId" AS "alloOrg",
           adv."organizationId" AS "advOrg", inv."organizationId" AS "invOrg"
    FROM "DocumentAdvanceAllocation" a
    JOIN "Document" adv ON adv."id" = a."advanceId"
    JOIN "Document" inv ON inv."id" = a."appliedToInvoice"
    WHERE a."organizationId" = ${organizationId}
      AND (a."organizationId" <> adv."organizationId"
           OR a."organizationId" <> inv."organizationId")
    LIMIT 50`
  for (const row of advanceOrgMismatch) {
    issues.push({
      kind: "advance-org-mismatch",
      recordId: row.id,
      detailSl: `Alokacija org ${row.alloOrg} ne ustreza org predujma ${row.advOrg} ali računa ${row.invOrg}.`,
    })
  }

  // ---- 3. Podvojeni CLEARED PAYMENT z isto reference na istem dokumentu ----
  // Idempotency kjuč plačila — dvojno knjiženje iste reference (razen
  // namernih popravkov) kaže na dvojno plačilo. Vežemo se na dokumente te
  // org in njihova plačila.
  const dupPaymentRefRows = await prisma.$queryRaw<
    { documentId: string; reference: string; cnt: bigint }[]
  >`
    SELECT p."documentId", p."reference", COUNT(*) AS "cnt"
    FROM "DocumentPayment" p
    JOIN "Document" d ON d."id" = p."documentId"
    WHERE d."organizationId" = ${organizationId}
      AND p."kind" = 'PAYMENT' AND p."status" = 'CLEARED' AND p."reference" IS NOT NULL
    GROUP BY p."documentId", p."reference"
    HAVING COUNT(*) > 1
    LIMIT 50`
  for (const row of dupPaymentRefRows) {
    issues.push({
      kind: "duplicate-cleared-payment-reference",
      recordId: `${row.documentId}#${row.reference}`,
      detailSl: `Dokument ${row.documentId} ima ${row.cnt} knjiženih plačil z isto reference »${row.reference}«.`,
    })
  }

  // ---- 4. >1 AKTIVNA alokacija istega predujma na isti račun ----
  // Več ACTIVE alokacij istega ADVANCE na isto INVOICE pomeni dvojno
  // porabo predujma (dokler prejšnja ni REVOKED).
  const dupActiveAllocRows = await prisma.$queryRaw<
    { advanceId: string; appliedToInvoice: string; cnt: bigint }[]
  >`
    SELECT "advanceId", "appliedToInvoice", COUNT(*) AS "cnt"
    FROM "DocumentAdvanceAllocation"
    WHERE "organizationId" = ${organizationId} AND "status" = 'ACTIVE'
    GROUP BY "advanceId", "appliedToInvoice"
    HAVING COUNT(*) > 1
    LIMIT 50`
  for (const row of dupActiveAllocRows) {
    issues.push({
      kind: "multiple-active-advance-allocation",
      recordId: `${row.advanceId}#${row.appliedToInvoice}`,
      detailSl: `Predujem ${row.advanceId} ima ${row.cnt} aktivnih alokacij na račun ${row.appliedToInvoice}.`,
    })
  }

  // ---- 5. OrderItem, ki nima obstoječega Orderja (sirota) ----
  // OrderItem je relacijska podrejenost Orderja; če Order ne obstaja več,
  // je vrstica osirotelena in bi jo testno brisanje org pustilo za sabo.
  const orphanOrderItems = await prisma.$queryRaw<{ itemId: string; orderId: string }[]>`
    SELECT oi."id" AS "itemId", oi."orderId"
    FROM "OrderItem" oi
    LEFT JOIN "Order" o ON o."id" = oi."orderId"
    WHERE o."organizationId" = ${organizationId}
      AND o."id" IS NULL
    LIMIT 50`
  for (const row of orphanOrderItems) {
    issues.push({
      kind: "orphan-order-item",
      recordId: row.itemId,
      detailSl: `OrderItem ${row.itemId} kaže na neobstoječ Order ${row.orderId}.`,
    })
  }

  // ---- 6. AppointmentService brez obstoječega termina (sirota) ----
  const orphanApptSvcs = await prisma.$queryRaw<{ svcId: string; apptId: string }[]>`
    SELECT asvc."id" AS "svcId", asvc."appointmentId"
    FROM "AppointmentService" asvc
    LEFT JOIN "Appointment" a ON a."id" = asvc."appointmentId"
    WHERE a."organizationId" = ${organizationId}
      AND a."id" IS NULL
    LIMIT 50`
  for (const row of orphanApptSvcs) {
    issues.push({
      kind: "orphan-appointment-service",
      recordId: row.svcId,
      detailSl: `AppointmentService ${row.svcId} kaže na neobstoječ termin ${row.apptId}.`,
    })
  }

  return issues
}

/**
 * Bodi lezen: ali je organizacija brez odkritih neskladnosti?
 * Uporabno za CI/read-only controllere, da ne razkrije detajlov.
 */
export async function isOrganizationIntegrityClean(organizationId: string): Promise<boolean> {
  const issues = await auditOrganizationIntegrity(organizationId)
  return issues.length === 0
}