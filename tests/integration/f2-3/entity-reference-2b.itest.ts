// ============================================================
// FAZA 2B — entityReference: org-scoped relacije (prava baza)
//
// Preveri univerzalni mehanizem povezovanja evidence zapisov prek
// stabilnega ExtensionRecord id-ja na 2 izoliranih organizacijah:
//   cb  (čebelar) — beekeeping profil z `bee-apiary`
//   mk  (mehanik) — ločen tenant (sosednji record = tuj)
// Neobstoječ id / napačna entiteta / tuji org → INVALID_REFERENCE.
// Poganja se: DATABASE_URL=<f631> npx tsx tests/integration/.../entity-reference-2b.itest.ts
// ============================================================
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: null as null | {
    user: { id: string; role: string; organizationId?: string | null; email?: string | null }
  },
  headerEntries: {} as Record<string, string>,
}))

vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async () => null,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock("next/headers", () => ({ headers: async () => new Headers(state.headerEntries) }))
vi.mock("@/lib/tenant-proof", () => ({
  ORG_PROOF_HEADER: "x-org-slug-proof",
  verifyOrgSlug: async () => true,
}))

import { prisma } from "@/lib/prisma"
import {
  createExtensionRecord,
  updateExtensionRecord,
  listExtensionRecordOptions,
  listExtensionRecords,
} from "@/app/actions/records"

let cb: { id: string; slug: string }
let mk: { id: string; slug: string }
let cbOwner: { id: string; role: string; organizationId: string }
let mkOwner: { id: string; role: string; organizationId: string }
let cleanupIds: string[] = []

async function mockSessionFor(email: string) {
  const u = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, organizationId: true },
  })
  if (!u) throw new Error(`ni uporabnika ${email}`)
  // F2.1: aktivna org je iz OrganizationMember (legacy User.organizationId je lahko null).
  let orgId = u.organizationId
  if (!orgId) {
    const mem = await prisma.organizationMember.findFirst({
      where: { userId: u.id },
      orderBy: { isDefault: "desc" },
      select: { organizationId: true },
    })
    orgId = mem?.organizationId ?? null
  }
  if (!orgId) throw new Error(`brez org za ${email}`)
  const isCb = email.startsWith("cb")
  state.session = { user: { id: u.id, role: u.role, organizationId: orgId } }
  state.headerEntries = { "x-org-slug": isCb ? cb.slug : mk.slug }
  return { id: u.id, role: u.role, organizationId: orgId }
}

beforeAll(async () => {
  const all = await prisma.organization.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true } })
  cb = all.find((o) => o.slug === "cebelar-test") ?? all[0]
  mk = all.find((o) => o.slug === "mehanik-test") ?? all[0] ?? all[1]
  cbOwner = (await mockSessionFor("cb@f631.test")) as typeof cbOwner
  mkOwner = (await mockSessionFor("mk@f631.test")) as typeof mkOwner
  cleanupIds = []
})

afterAll(async () => {
  if (cleanupIds.length) await prisma.extensionRecord.deleteMany({ where: { id: { in: cleanupIds } } })
  if (state) {}
  await prisma.$disconnect()
})

describe("Faza 2B — entityReference (2 organizaciji)", () => {
  it("1) shrani veljaven id reference (apiary → hive)", async () => {
    await mockSessionFor("cb@f631.test")
    const a = await createExtensionRecord({
      entityKey: "apiary",
      values: { name: "RefTest-Postaja", location: "Test", notes: "" },
    })
    expect(a.ok).toBe(true)
    const apiaryId = a.id!
    cleanupIds.push(apiaryId)

    const h = await createExtensionRecord({
      entityKey: "hive",
      values: {
        label: "RefTest-Panj",
        apiary_ref: apiaryId,
        hive_type: "AŽ",
        strength: "Močna",
        notes: "",
      },
    })
    expect(h.ok, JSON.stringify(h)).toBe(true)
    cleanupIds.push(h.id!)
  })

  it("2) neobstoječ id → INVALID_REFERENCE", async () => {
    await mockSessionFor("cb@f631.test")
    const h = await createExtensionRecord({
      entityKey: "hive",
      values: { label: "Panj-ne", apiary_ref: "nope-not-a-real-id", hive_type: "AŽ" },
    })
    expect(h.ok).toBe(false)
    expect(h.error).toBe("INVALID_REFERENCE")
  })

  it("3) id napačne entitete → INVALID_REFERENCE (posredno API klic, ne UI)", async () => {
    await mockSessionFor("cb@f631.test")
    // Serija (batch-production) ni dovoljen cilj za hive.apiary_ref (bee-apiary/apiary).
    const b = await createExtensionRecord({
      entityKey: "batch",
      values: {
        batch_code: "REF-BATCH-NE",
        production_date: "2026-01-01",
        quantity_kg: 1,
        product_type: "Cvetlični med",
        notes: "",
      },
    })
    expect(b.ok).toBe(true)
    cleanupIds.push(b.id!)
    const h = await createExtensionRecord({
      entityKey: "hive",
      values: { label: "Panj-ne2", apiary_ref: b.id!, hive_type: "AŽ" },
    })
    expect(h.ok).toBe(false)
    expect(h.error).toBe("INVALID_REFERENCE")
  })

  it("4) id iz DRUGE organizacije → INVALID_REFERENCE (IDOR zaščita)", async () => {
    // Ustvari (surov) record "apiary" v mehanikovi org prek prisma (tujega čebelarju).
    const foreign = await prisma.extensionRecord.create({
      data: {
        organizationId: mk.id,
        extensionId: "bee-apiary",
        entityKey: "apiary",
        title: "Foreign-Apiary",
        data: { name: "Foreign-Apiary" },
      },
    })
    cleanupIds.push(foreign.id)
    await mockSessionFor("cb@f631.test")
    const h = await createExtensionRecord({
      entityKey: "hive",
      values: { label: "Panj-ne3", apiary_ref: foreign.id, hive_type: "AŽ" },
    })
    expect(h.ok).toBe(false)
    expect(h.error).toBe("INVALID_REFERENCE")
  })

  it("5) posodobitev reference na drugo vrednost + odstranitev (update)", async () => {
    await mockSessionFor("cb@f631.test")
    const a1 = await createExtensionRecord({ entityKey: "apiary", values: { name: "P-A", notes: "" } })
    expect(a1.ok).toBe(true)
    cleanupIds.push(a1.id!)
    const a2 = await createExtensionRecord({ entityKey: "apiary", values: { name: "P-B", notes: "" } })
    expect(a2.ok).toBe(true)
    cleanupIds.push(a2.id!)

    const h = await createExtensionRecord({
      entityKey: "hive",
      values: { label: "Panj-up", apiary_ref: a1.id!, hive_type: "AŽ" },
    })
    expect(h.ok).toBe(true)
    cleanupIds.push(h.id!)

    const up = await updateExtensionRecord(h.id!, {
      entityKey: "hive",
      values: { label: "Panj-up", apiary_ref: a2.id!, hive_type: "AŽ" },
    })
    expect(up.ok).toBe(true)

    // Odstranitev neobvezne reference (null → prazno polje).
    const rm = await updateExtensionRecord(h.id!, {
      entityKey: "hive",
      values: { label: "Panj-up", apiary_ref: null, hive_type: "AŽ" },
    })
    expect(rm.ok).toBe(true)
  })

  it("6) picker ne prikazuje zapisov druge organizacije", async () => {
    await mockSessionFor("cb@f631.test")
    const aCb = await createExtensionRecord({ entityKey: "apiary", values: { name: "Picker-Cb", notes: "" } })
    expect(aCb.ok).toBe(true)
    cleanupIds.push(aCb.id!)
    const optsCb = await listExtensionRecordOptions({ extensionId: "bee-apiary", entityKey: "apiary" })
    const titlesCb = optsCb.map((o) => o.title)
    expect(titlesCb).toContain("Picker-Cb")

    // mehanikova org — ne sme videti cb-jevih apiary recordov.
    await mockSessionFor("mk@f631.test")
    const optsMk = await listExtensionRecordOptions({ extensionId: "bee-apiary", entityKey: "apiary" })
    const titlesMk = optsMk.map((o) => o.title)
    expect(titlesMk).not.toContain("Picker-Cb")
  })

  it("7) regresija: non-reference (batch) in brez referenc delujeta naprej", async () => {
    await mockSessionFor("cb@f631.test")
    const b = await createExtensionRecord({
      entityKey: "batch",
      values: {
        batch_code: "REG-BATCH",
        production_date: "2026-02-01",
        quantity_kg: 5,
        product_type: "Lipov med",
        notes: "",
      },
    })
    expect(b.ok).toBe(true)
    cleanupIds.push(b.id!)
    const rows = await listExtensionRecords("batch")
    expect(Array.isArray(rows)).toBe(true)
    const t = rows.map((r) => r.title)
    expect(t).toContain("REG-BATCH")
  })
})