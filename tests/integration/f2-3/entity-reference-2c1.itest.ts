// ============================================================
// FAZA 2C-1 — večvrstne entityReference (prava baza, 2 org)
// Preveri: multi-target format objekt {id, extensionId, entityKey},
// org-scope + allowed-set validacija, kompat z 2B single string.
// Poganja: DATABASE_URL=<f631> npx tsx tests/integration/.../entity-reference-2c1.itest.ts
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
  listExtensionRecords,
} from "@/app/actions/records"

let cb: { id: string; slug: string }
let mk: { id: string; slug: string }
let cleanupIds: string[] = []

async function mockSessionFor(email: string, slug: string) {
  const u = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, organizationId: true },
  })
  if (!u) throw new Error(`ni uporabnika ${email}`)
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
  state.session = { user: { id: u.id, role: u.role, organizationId: orgId } }
  state.headerEntries = { "x-org-slug": slug }
}

beforeAll(async () => {
  const all = await prisma.organization.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true } })
  cb = all.find((o) => o.slug === "cebelar-test") ?? all[0]
  mk = all.find((o) => o.slug === "mehanik-test") ?? all[1]
  cleanupIds = []
})

afterAll(async () => {
  if (cleanupIds.length) await prisma.extensionRecord.deleteMany({ where: { id: { in: cleanupIds } } })
  await prisma.$disconnect()
})

async function makeTarget(cbRunner: boolean, entityKey: string, name?: string) {
  // Ustvari ciljni record (apiary/hive/colony) v cb org prek prisma (ali mk za tuj).
  const orgId = cbRunner ? cb.id : mk.id
  const rec = await prisma.extensionRecord.create({
    data: {
      organizationId: orgId,
      extensionId: "bee-apiary",
      entityKey,
      title: name ?? `TGT-${entityKey}-${Date.now()}`,
      data: { label: name ?? `TGT-${entityKey}` },
    },
  })
  if (cbRunner) cleanupIds.push(rec.id)
  return rec
}

describe("Faza 2C-1 — večvrstne entityReference", () => {
  it("B1/B2/B3: shrani multi objekt na apiary / hive / colony", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    for (const ek of ["apiary", "hive", "colony"]) {
      const tgt = await makeTarget(true, ek)
      const r = await createExtensionRecord({
        entityKey: "task",
        values: {
          task_date: "2026-03-01",
          task_type: "Pregled",
          target_ref: { id: tgt.id, extensionId: "bee-apiary", entityKey: ek },
        },
      })
      expect(r.ok, `${ek}: ${JSON.stringify(r)}`).toBe(true)
      cleanupIds.push(r.id!)
    }
  })

  it("B4: razberemo shranjen objekt (id, extensionId, entityKey) ob ponovnem branju", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const tgt = await makeTarget(true, "apiary")
    const r = await createExtensionRecord({
      entityKey: "task",
      values: { task_date: "2026-03-02", task_type: "Pregled", target_ref: { id: tgt.id, extensionId: "bee-apiary", entityKey: "apiary" } },
    })
    expect(r.ok).toBe(true)
    cleanupIds.push(r.id!)
    const rows = await listExtensionRecords("task")
    const rec = rows.find((x) => x.id === r.id)
    const ref = rec?.data.target_ref as { id?: string; extensionId?: string; entityKey?: string } | null
    expect(ref).toEqual({ id: tgt.id, extensionId: "bee-apiary", entityKey: "apiary" })
  })

  it("C1: neobstoječ id → INVALID_REFERENCE", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const r = await createExtensionRecord({
      entityKey: "task",
      values: { task_date: "2026-03-03", task_type: "Pregled", target_ref: { id: "cmwNOPE0000000000000000001", extensionId: "bee-apiary", entityKey: "apiary" } },
    })
    expect(r.ok).toBe(false)
    expect(r.error).toBe("INVALID_REFERENCE")
  })

  it("C2: napačen extensionId → INVALID_REFERENCE", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const tgt = await makeTarget(true, "apiary")
    const r = await createExtensionRecord({
      entityKey: "task",
      values: { task_date: "2026-03-04", task_type: "Pregled", target_ref: { id: tgt.id, extensionId: "batch-production", entityKey: "apiary" } },
    })
    expect(r.ok).toBe(false)
    expect(r.error).toBe("INVALID_REFERENCE")
  })

  it("C3: napačen entityKey → INVALID_REFERENCE", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const tgt = await makeTarget(true, "apiary")
    const r = await createExtensionRecord({
      entityKey: "task",
      values: { task_date: "2026-03-05", task_type: "Pregled", target_ref: { id: tgt.id, extensionId: "bee-apiary", entityKey: "batch" } },
    })
    expect(r.ok).toBe(false)
    expect(r.error).toBe("INVALID_REFERENCE")
  })

  it("C4: kombinacija, ki ni dovoljena v referenceTo → INVALID_REFERENCE", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    // batch ni dovoljen cilj za task.target_ref (allowed: apiary|hive|colony)
    const b = await makeTarget(true, "batch")
    const r = await createExtensionRecord({
      entityKey: "task",
      values: { task_date: "2026-03-06", task_type: "Pregled", target_ref: { id: b.id, extensionId: "batch-production", entityKey: "batch" } },
    })
    expect(r.ok).toBe(false)
    expect(r.error).toBe("INVALID_REFERENCE")
  })

  it("C5: id iz druge organizacije → INVALID_REFERENCE (IDOR)", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const foreign = await makeTarget(false, "apiary") // v mk org
    const r = await createExtensionRecord({
      entityKey: "task",
      values: { task_date: "2026-03-07", task_type: "Pregled", target_ref: { id: foreign.id, extensionId: "bee-apiary", entityKey: "apiary" } },
    })
    expect(r.ok).toBe(false)
    expect(r.error).toBe("INVALID_REFERENCE")
  })

  it("C6: napačen format (multi polje dobi string namesto objekta) → zavrnjeno", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const tgt = await makeTarget(true, "apiary")
    const r = await createExtensionRecord({
      entityKey: "task",
      values: { task_date: "2026-03-08", task_type: "Pregled", target_ref: tgt.id }, // string v multi polju
    })
    // Zavrnjeno — bodisi VALIDATION (format v field-validation) ali INVALID_REFERENCE;
    // ključno: field napaka = INVALID_REFERENCE in ni tihega sprejema.
    expect(r.ok).toBe(false)
    const fieldErr = (r.fieldErrors ?? {})["target_ref"]
    expect(fieldErr).toBe("INVALID_REFERENCE")
  })

  it("C7: poskus obhoda — direktni update s tujim/nedovoljenim objektom → INVALID_REFERENCE", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const tgt = await makeTarget(true, "apiary")
    const r = await createExtensionRecord({
      entityKey: "task",
      values: { task_date: "2026-03-09", task_type: "Pregled", target_ref: { id: tgt.id, extensionId: "bee-apiary", entityKey: "apiary" } },
    })
    expect(r.ok).toBe(true)
    cleanupIds.push(r.id!)
    const foreign = await makeTarget(false, "hive") // tuj
    const up = await updateExtensionRecord(r.id!, {
      entityKey: "task",
      values: { task_date: "2026-03-09", task_type: "Pregled", target_ref: { id: foreign.id, extensionId: "bee-apiary", entityKey: "hive" } },
    })
    expect(up.ok).toBe(false)
    expect(up.error).toBe("INVALID_REFERENCE")
  })

  it("B0/single kompat: single entityReference (hive_ref) še sprejme string id (2B)", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const hive = await makeTarget(true, "hive")
    const r = await createExtensionRecord({
      entityKey: "colony",
      values: { label: "Kol-2C1", hive_ref: hive.id, notes: "" },
    })
    expect(r.ok, JSON.stringify(r)).toBe(true)
    cleanupIds.push(r.id!)
    const rows = await listExtensionRecords("colony")
    const rec = rows.find((x) => x.id === r.id)
    expect(rec?.data.hive_ref).toBe(hive.id) // še vedno string, ne objekt
  })
})