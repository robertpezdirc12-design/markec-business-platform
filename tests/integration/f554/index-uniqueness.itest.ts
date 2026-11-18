// ============================================================
// F5.5.4.4.1 — DELNI UNIKATNI INDEKS DocumentPayment.
//
// Preverja dejansko obnašanje DB-indeksa `DocumentPayment_org_doc_ref_key`
// (delni, WHERE reference IS NOT NULL), ki ga upravljamo prek migracije SQL
// (20261209000000_f5542_payments_creditnotes) in ga Prisma 6.19 ne more
// deklarirati v datamodelu. Run na ločeni bazi markec_f554_test.
// ============================================================

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@/lib/prisma"

const ORG_A = "f55441-org-a"
const ORG_B = "f55441-org-b"
const DOC_A = "f55441-doc-a"
const DOC_B = "f55441-doc-b"

async function clean() {
  await prisma.$executeRawUnsafe(`DELETE FROM "DocumentPayment" WHERE "organizationId" IN ('${ORG_A}','${ORG_B}')`)
  await prisma.$executeRawUnsafe(`DELETE FROM "Document" WHERE "id" IN ('${DOC_A}','${DOC_B}')`)
  await prisma.$executeRawUnsafe(`DELETE FROM "Organization" WHERE "id" IN ('${ORG_A}','${ORG_B}')`)
}

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  expect(["markec_f554_test", "markec_e2e_test", "markec_it"]).toContain(rows[0].db)
  await clean()
  // Organizacije + dokumenta (minimalni stolpci, ki jih FK zahteva).
  await prisma.organization.createMany({ data: [{ id: ORG_A, name: ORG_A, slug: ORG_A }, { id: ORG_B, name: ORG_B, slug: ORG_B }] })
  await prisma.document.createMany({
    data: [
      { id: DOC_A, organizationId: ORG_A, type: "INVOICE", number: 1, fiscalYear: 2026, status: "ISSUED", subtotal: 100, total: 100 },
      { id: DOC_B, organizationId: ORG_A, type: "INVOICE", number: 2, fiscalYear: 2026, status: "ISSUED", subtotal: 100, total: 100 },
    ],
  })
})

afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

async function assertIndexExists() {
  const idx = await prisma.$queryRawUnsafe<{ indexdef: string }[]>(
    `SELECT indexdef FROM pg_indexes WHERE tablename='DocumentPayment' AND indexname='DocumentPayment_org_doc_ref_key'`
  )
  expect(idx.length).toBe(1)
  expect(idx[0].indexdef).toMatch(/UNIQUE INDEX/)
  // pg_indexes poroča predikat kot "WHERE (reference IS NOT NULL)" (zgornji oklepaj odovija položi Prisma/db push za generacijo).
  expect(idx[0].indexdef).toMatch(/WHERE \(reference IS NOT NULL\)/)
}

async function insertPayment(orgId: string, docId: string, reference: string | null) {
  return prisma.$executeRawUnsafe(
    `INSERT INTO "DocumentPayment" ("id","organizationId","documentId","kind","amount","reference")
     VALUES ($1,$2,$3,'PAYMENT',$4,$5)`,
    `p-${Math.random().toString(36).slice(2)}`, orgId, docId, 10, reference
  )
}

describe("DocumentPayment delni unikatni indeks", () => {
  it("indeks obstaja s pravilno definicijo (WHERE reference IS NOT NULL)", async () => {
    await assertIndexExists()
  })

  it("ista referenca za isti dokument se NE da vknjižiti dvakrat", async () => {
    await insertPayment(ORG_A, DOC_A, "REF-1")
    await expect(insertPayment(ORG_A, DOC_A, "REF-1")).rejects.toThrow()
  })

  it("NULL reference se lahko večkrat knjiži (delni indeks jih ne unikatno stiska)", async () => {
    await insertPayment(ORG_A, DOC_A, null)
    await insertPayment(ORG_A, DOC_A, null)
    await insertPayment(ORG_A, DOC_A, null)
  })

  it("različni dokumenti iste org lahko uporabljajo isto referenco", async () => {
    await insertPayment(ORG_A, DOC_B, "REF-1") // ista ref kot DOC_A, drug dokument
  })

  it("različne organizacije so izolirane (ista ref, drug org)", async () => {
    await prisma.document.create({
      data: { id: "f55441-doc-b1", organizationId: ORG_B, type: "INVOICE", number: 1, fiscalYear: 2026, status: "ISSUED", subtotal: 100, total: 100 },
    })
    await insertPayment(ORG_B, "f55441-doc-b1", "REF-1") // ista ref kot ORG_A, drug org → dovoljeno
  })
})