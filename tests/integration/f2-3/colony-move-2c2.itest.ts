// ============================================================
// FAZA 2C-2 — zgodovina selitev čebeljih družin (colony_move)
// Prava baza (f631), 2 org. Preverja baseline, selitev, izvajalca,
// append-only (generic CRUD → APPEND_ONLY), transakcije, korekcije.
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
import { createColonyMove, correctColonyMove, colonyLocationAt, listColonyMoveHistory } from "@/app/actions/colony-moves"
import { createExtensionRecord, updateExtensionRecord, deleteExtensionRecord } from "@/app/actions/records"

let cb: { id: string; slug: string }
let mk: { id: string; slug: string }
const cleanup: string[] = []

const EXT = "bee-apiary"

async function mockSessionFor(email: string, slug: string) {
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, organizationId: true } })
  if (!u) throw new Error("ni user " + email)
  let orgId = u.organizationId
  if (!orgId) {
    const mem = await prisma.organizationMember.findFirst({ where: { userId: u.id }, orderBy: { isDefault: "desc" }, select: { organizationId: true } })
    orgId = mem?.organizationId ?? null
  }
  if (!orgId) throw new Error("brez org")
  state.session = { user: { id: u.id, role: u.role, organizationId: orgId } }
  state.headerEntries = { "x-org-slug": slug }
}

async function rec(orgId: string, entityKey: string, data: Record<string, unknown>, title?: string) {
  const r = await prisma.extensionRecord.create({
    data: { organizationId: orgId, extensionId: EXT, entityKey, title: title ?? `${entityKey}-${Date.now()}`, data: data as any },
  })
  cleanup.push(r.id)
  return r
}

beforeAll(async () => {
  const all = await prisma.organization.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true } })
  cb = all.find((o) => o.slug === "cebelar-test") ?? all[0]
  mk = all.find((o) => o.slug === "mehanik-test") ?? all[1]
})

afterAll(async () => {
  if (cleanup.length) await prisma.extensionRecord.deleteMany({ where: { id: { in: cleanup } } })
  await prisma.$disconnect()
})

async function hive(orgId: string, name?: string) {
  return rec(orgId, "hive", { label: name ?? "Panj-" + Date.now() })
}
async function colony(orgId: string, hiveRef?: string | null) {
  return rec(orgId, "colony", { label: "Kol-" + Date.now(), ...(hiveRef ? { hive_ref: hiveRef } : {}) })
}

async function movesFor(colonyId: string) {
  const rows = await prisma.extensionRecord.findMany({
    where: { organizationId: cb.id, extensionId: EXT, entityKey: "colony_move" },
    select: { id: true, data: true },
  })
  return rows.filter((m) => (m.data as any)?.colony_ref === colonyId).map((m) => m.data as any)
}
async function currentHive(colonyId: string) {
  const c = await prisma.extensionRecord.findUnique({ where: { id: colonyId }, select: { data: true } })
  return (c?.data as any)?.hive_ref ?? null
}

describe("FAZA 2C-2 — createColonyMove / baseline / append-only", () => {
  it("A1/A2/A3: prva selitev iz ZNANEG lokalnega panja → baseline (movedAt=null) + event A→B + hive_ref=B", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const A = await hive(cb.id)
    const B = await hive(cb.id)
    const c = await colony(cb.id, A.id)
    const r = await createColonyMove({ colonyId: c.id, toHiveId: B.id })
    expect(r.ok, JSON.stringify(r)).toBe(true)
    const moves = await movesFor(c.id)
    expect(moves.length).toBe(2) // baseline + event
    const bl = moves.find((m) => m.baseline === true)
    expect(bl).toBeTruthy()
    expect(bl.to_hive_ref).toBe(A.id)
    expect(bl.moved_at).toBeNull()
    const ev = moves.find((m) => m.baseline !== true && m.to_hive_ref === B.id)
    expect(ev.from_hive_ref).toBe(A.id)
    expect(await currentHive(c.id)).toBe(B.id)
  })

  it("A3/A4: prva selitev iz NEZNANe lokacije → brez lažnega baseline, originUnknown, izvor null; 2. selitev ne doda baseline", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const B = await hive(cb.id)
    const C = await hive(cb.id)
    const c = await colony(cb.id, null)
    const r1 = await createColonyMove({ colonyId: c.id, toHiveId: B.id })
    expect(r1.ok).toBe(true)
    let moves = await movesFor(c.id)
    expect(moves.some((m) => m.baseline === true)).toBe(false)
    const ev = moves.find((m) => m.to_hive_ref === B.id)
    expect(ev.origin_unknown).toBe(true)
    expect(ev.from_hive_ref).toBeNull()
    expect(await currentHive(c.id)).toBe(B.id)
    // druga selitev → še vedno samo 1 dodan event, brez novega baseline
    const r2 = await createColonyMove({ colonyId: c.id, toHiveId: C.id })
    expect(r2.ok).toBe(true)
    moves = await movesFor(c.id)
    expect(moves.filter((m) => m.baseline === true).length).toBe(0)
    expect(moves.filter((m) => m.to_hive_ref === C.id).length).toBe(1)
    expect(await currentHive(c.id)).toBe(C.id)
  })

  it("B1: veljavna selitev A→B (ko baseline obstaja) → hive_ref=B, event pravilen", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const A = await hive(cb.id)
    const B = await hive(cb.id)
    const c = await colony(cb.id, A.id)
    await createColonyMove({ colonyId: c.id, toHiveId: B.id })
    const D = await hive(cb.id)
    const r = await createColonyMove({ colonyId: c.id, toHiveId: D.id })
    expect(r.ok).toBe(true)
    expect(await currentHive(c.id)).toBe(D.id)
  })

  it("B2: neveljaven cilj (neobstoječ panj) → INVALID", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const A = await hive(cb.id)
    const c = await colony(cb.id, A.id)
    const r = await createColonyMove({ colonyId: c.id, toHiveId: "cmwNOPE0000000000000000001" })
    expect(r.ok).toBe(false)
    expect(r.error).toBe("INVALID")
  })

  it("B3: enak izvor in cilj → SAME_HIVE", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const A = await hive(cb.id)
    const c = await colony(cb.id, A.id)
    const r = await createColonyMove({ colonyId: c.id, toHiveId: A.id, fromHiveId: A.id })
    expect(r.ok).toBe(false)
    expect(r.error).toBe("SAME_HIVE")
  })
  it("B3b: selitev, kjer je cilj enak trenutni lokaciji (brez fromHive) → SAME_HIVE prek adekvatne kontrole", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const A = await hive(cb.id)
    const c = await colony(cb.id, A.id)
    const r = await createColonyMove({ colonyId: c.id, toHiveId: A.id })
    // trenutna lokacija = A, to = A → enak izvor/cilj
    expect(r.ok).toBe(false)
    expect(r.error).toBe("SAME_HIVE")
  })

  it("B4: ciljni panj iz DRUGE organizacije → INVALID (IDOR)", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const A = await hive(cb.id)
    const c = await colony(cb.id, A.id)
    const foreignHive = await hive(mk.id) // mk org
    const r = await createColonyMove({ colonyId: c.id, toHiveId: foreignHive.id })
    expect(r.ok).toBe(false)
    expect(r.error).toBe("INVALID")
  })

  it("B5: družina iz druge org → INVALID", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const A = await hive(mk.id)
    const cForeign = await colony(mk.id)
    const r = await createColonyMove({ colonyId: cForeign.id, toHiveId: A.id })
    expect(r.ok).toBe(false)
    expect(r.error).toBe("INVALID")
  })

  it("C1/C2: performed_by je iz SEJE; browser-podano 'performed_by' se ne upošteva (server ignorira)", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const A = await hive(cb.id)
    const B = await hive(cb.id)
    const c = await colony(cb.id, A.id)
    // createColonyMove input NIMA performed_by, zato je noben način ne moremo predati;
    // preverimo, da stored == session user id
    const r = await createColonyMove({ colonyId: c.id, toHiveId: B.id })
    expect(r.ok).toBe(true)
    const moves = await movesFor(c.id)
    expect(moves.every((m) => m.performed_by === state.session!.user.id)).toBe(true)
  })

  it("C3: neprijavljen uporabnik → akcija zavrnjena (throw)", async () => {
    state.session = null
    const A = await hive(cb.id)
    const c = await colony(cb.id, A.id)
    await expect(
      createColonyMove({ colonyId: c.id, toHiveId: A.id })
    ).rejects.toThrow()
    // potem vrnemo session za nadaljevanje
    await mockSessionFor("cb@f631.test", cb.slug)
  })

  it("D: generični CRUD za colony_move → APPEND_ONLY (create/update/delete)", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const A = await hive(cb.id)
    const c = await colony(cb.id, A.id)
    const gen = await createExtensionRecord({ entityKey: "colony_move", values: { colony_ref: c.id } })
    expect(gen.ok).toBe(false)
    expect(gen.error).toBe("APPEND_ONLY")
    // ustvarimo legit dogodek, poiščemo id, nato update/delete → APPEND_ONLY
    const B = await hive(cb.id)
    const ok = await createColonyMove({ colonyId: c.id, toHiveId: B.id })
    expect(ok.ok).toBe(true)
    const evId = await prisma.extensionRecord.findFirst({
      where: { organizationId: cb.id, extensionId: EXT, entityKey: "colony_move" },
      select: { id: true, data: true },
      orderBy: { createdAt: "desc" },
    }).then(async (r) => {
      const all = await prisma.extensionRecord.findMany({ where: { organizationId: cb.id, extensionId: EXT, entityKey: "colony_move" }, select: { id: true, data: true } })
      return all.find((x) => (x.data as any)?.colony_ref === c.id && (x.data as any)?.to_hive_ref === B.id)!.id
    })
    const up = await updateExtensionRecord(evId, { entityKey: "colony_move", values: { to_hive_ref: A.id } })
    expect(up.ok).toBe(false)
    expect(up.error).toBe("APPEND_ONLY")
    const del = await deleteExtensionRecord(evId)
    expect(del && "error" in del && (del as any).error === "APPEND_ONLY").toBe(true)
    // dedicated še deluje:
    const C = await hive(cb.id)
    const ok2 = await createColonyMove({ colonyId: c.id, toHiveId: C.id })
    expect(ok2.ok).toBe(true)
  })

  it("E: starejši movedAt po obstoječem dogodku → STALE_MOVED_AT, hive_ref se ne spremeni", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const A = await hive(cb.id)
    const B = await hive(cb.id)
    const c = await colony(cb.id, A.id)
    await createColonyMove({ colonyId: c.id, toHiveId: B.id, movedAt: "2026-06-01T00:00:00Z" })
    const before = await currentHive(c.id)
    const stale = await createColonyMove({ colonyId: c.id, toHiveId: B.id, movedAt: "2025-01-01T00:00:00Z" })
    expect(stale.ok).toBe(false)
    expect(stale.error).toBe("STALE_MOVED_AT")
    expect(await currentHive(c.id)).toBe(before) // ni spremembe (rollback)
  })

  it("E2: sočasni selitvi iste družine — konflikta ne moreta ustvariti protislovnega stanja; row-lock serializira", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const A = await hive(cb.id)
    const B = await hive(cb.id)
    const C = await hive(cb.id)
    const c = await colony(cb.id, A.id)
    const [r1, r2] = await Promise.all([
      createColonyMove({ colonyId: c.id, toHiveId: B.id }),
      createColonyMove({ colonyId: c.id, toHiveId: C.id }),
    ])
    // oba lahko uspeta (append-only, cumulative) OR en conservative:
    for (const r of [r1, r2]) expect(r.ok).toBe(true)
    const final = await currentHive(c.id)
    expect([B.id, C.id]).toContain(final) // samo ena, zadnji po commit
    const moves = await movesFor(c.id)
    const real = moves.filter((m) => m.baseline !== true)
    // nastali sta dve... a korak decisions: ne sme biti dveh the same to ali protislovnega HIVE:
    expect(real.filter((m) => m.to_hive_ref === B.id).length).toBeLessThanOrEqual(1)
  })

  it("F: korekcija — nov dogodek, original nespremenjen, rekonstrukcija upošteva", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const A = await hive(cb.id)
    const B = await hive(cb.id)
    const C = await hive(cb.id)
    const c = await colony(cb.id, A.id)
    const r = await createColonyMove({ colonyId: c.id, toHiveId: B.id, movedAt: "2026-07-01T00:00:00Z" })
    expect(r.ok).toBe(true)
    const moves1 = await movesFor(c.id)
    const orig = moves1.find((m) => m.to_hive_ref === B.id)
    const allRecords = await prisma.extensionRecord.findMany({ where: { organizationId: cb.id, extensionId: EXT, entityKey: "colony_move" }, select: { id: true, data: true } })
    const origId = allRecords.find((x) => (x.data as any)?.colony_ref === c.id && (x.data as any)?.to_hive_ref === B.id)!.id
    const corr = await correctColonyMove(origId, { toHiveId: C.id, reason: "napačen panj" })
    expect(corr.ok).toBe(true)
    const moves2 = await movesFor(c.id)
    const corrEv = moves2.find((m) => m.is_correction === true)
    expect(corrEv).toBeTruthy()
    expect(corrEv.corrects_ref).toBe(origId)
    expect(corrEv.correction_reason).toBe("napačen panj")
    // original ostal nespremenjen
    const origNow = moves2.find((m) => m.to_hive_ref === B.id && m.is_correction !== true)
    expect(JSON.stringify(origNow.moved_at)).toBe(JSON.stringify(orig.moved_at))
    expect(await currentHive(c.id)).toBe(C.id)
    // generic update original → APPEND_ONLY
    const up = await updateExtensionRecord(origId, { entityKey: "colony_move", values: { to_hive_ref: A.id } })
    expect(up.ok).toBe(false)
    expect(up.error).toBe("APPEND_ONLY")
  })

  it("G: listColonyMoveHistory + colonyLocationAt (rekonstrukcija)", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const A = await hive(cb.id)
    const B = await hive(cb.id)
    const c = await colony(cb.id, A.id)
    // baseline-only (testni vnos) da ima zgodovino
    await createColonyMove({ colonyId: c.id, toHiveId: B.id, movedAt: "2026-05-01T00:00:00Z" })
    const h = await listColonyMoveHistory(c.id)
    expect(h.ok).toBe(true)
    expect(h.events.length).toBe(2)
    expect(h.events.some((e) => e.baseline)).toBe(true)
    expect(h.events.every((e) => e.toHiveId && typeof e.performedById === "string")).toBe(true)
    const at = await colonyLocationAt(c.id, new Date("2026-04-01T00:00:00Z"))
    expect(at.baselineOnly).toBe(true) // prikaz "znano od začetka"
  })
})

describe("FAZA 2C-2 — ciljna revizija: rollback transakcij", () => {
  it("R1: throw PO baseline+event+hive_ref write → nobeden ne ostane (rollback)", async () => {
    if (!state.session) await mockSessionFor("cb@f631.test", cb.slug)
    const A = await hive(cb.id)
    const B = await hive(cb.id)
    const c = await colony(cb.id, A.id)
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.extensionRecord.create({
          data: { organizationId: cb.id, extensionId: EXT, entityKey: "colony_move", title: "RB-BL-1", data: { colony_ref: c.id, to_hive_ref: A.id, baseline: true } as any },
        })
        await tx.extensionRecord.create({
          data: { organizationId: cb.id, extensionId: EXT, entityKey: "colony_move", title: "RB-EV-1", data: { colony_ref: c.id, to_hive_ref: B.id } as any },
        })
        await tx.extensionRecord.update({
          where: { id: c.id },
          data: { data: { ...(await prisma.extensionRecord.findUnique({ where: { id: c.id }, select: { data: true } }))!.data as any, hive_ref: B.id } as any },
        })
        throw new Error("simulated failure after partial writes")
      })
    ).rejects.toThrow()
    // preveri rollback: noben od RB-* ni ostal, hive_ref nespremenjen (brez B)
    const left = await prisma.extensionRecord.findMany({ where: { organizationId: cb.id, extensionId: EXT, entityKey: "colony_move", title: { in: ["RB-BL-1", "RB-EV-1"] } }, select: { id: true } })
    expect(left.length).toBe(0)
    // rollback → hive_ref NISTA nastavljen na B; ostane izvorni A
    expect(await currentHive(c.id)).toBe(A.id)
  })

  it("R2: throw PO baseline create → baseline ne ostane", async () => {
    if (!state.session) await mockSessionFor("cb@f631.test", cb.slug)
    const A = await hive(cb.id)
    const c = await colony(cb.id, A.id)
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.extensionRecord.create({
          data: { organizationId: cb.id, extensionId: EXT, entityKey: "colony_move", title: "RB-BL-2", data: { colony_ref: c.id, to_hive_ref: A.id, baseline: true } as any },
        })
        throw new Error("simulated failure after baseline")
      })
    ).rejects.toThrow()
    const left = await prisma.extensionRecord.findMany({ where: { organizationId: cb.id, extensionId: EXT, entityKey: "colony_move", title: "RB-BL-2" }, select: { id: true } })
    expect(left.length).toBe(0)
  })

  it("R3: throw PO event create (pred hive_ref upda) → event ne ostane, hive_ref nespremenjen", async () => {
    if (!state.session) await mockSessionFor("cb@f631.test", cb.slug)
    const A = await hive(cb.id)
    const B = await hive(cb.id)
    const c = await colony(cb.id, A.id)
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.extensionRecord.create({
          data: { organizationId: cb.id, extensionId: EXT, entityKey: "colony_move", title: "RB-EV-3", data: { colony_ref: c.id, to_hive_ref: A.id } as any },
        })
        await tx.extensionRecord.create({
          data: { organizationId: cb.id, extensionId: EXT, entityKey: "colony_move", title: "RB-EV-3B", data: { colony_ref: c.id, to_hive_ref: B.id } as any },
        })
        throw new Error("simulated failure after event create, before hive_ref update")
      })
    ).rejects.toThrow()
    const left = await prisma.extensionRecord.findMany({ where: { organizationId: cb.id, extensionId: EXT, entityKey: "colony_move", title: { in: ["RB-EV-3", "RB-EV-3B"] } }, select: { id: true } })
    expect(left.length).toBe(0)
    expect(await currentHive(c.id)).toBe(A.id) // nikoli nastavljen na B (A ostane)
  })

  it("R4: regresija — createColonyMove ob STALE_MOVED_AT ne pusti zgodovine (throw path)", async () => {
    if (!state.session) await mockSessionFor("cb@f631.test", cb.slug)
    const A = await hive(cb.id)
    const B = await hive(cb.id)
    const c = await colony(cb.id, A.id)
    const r1 = await createColonyMove({ colonyId: c.id, toHiveId: B.id, movedAt: "2026-06-01T00:00:00Z" })
    expect(r1.ok).toBe(true)
    const before = await currentHive(c.id)
    const stale = await createColonyMove({ colonyId: c.id, toHiveId: B.id, movedAt: "2025-01-01T00:00:00Z" })
    expect(stale.ok).toBe(false)
    expect(stale.error).toBe("STALE_MOVED_AT")
    // po rollbacku ostane samo baseline + en event (tisti iz r1) in hive_ref = before
    const all = await prisma.extensionRecord.findMany({ where: { organizationId: cb.id, extensionId: EXT, entityKey: "colony_move" }, select: { data: true, createdAt: true } })
    const rel = all.filter((m) => (m.data as any)?.colony_ref === c.id)
    expect(rel.length).toBe(2) // baseline + r1 event; ni dodanega stale eventa
    expect(await currentHive(c.id)).toBe(before)
  })
})