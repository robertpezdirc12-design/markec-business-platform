// ============================================================
// FAZA 2C-3 — RecordDetail podatki (listColonyMoveDetail) + names
// Prava baza (f631), 2 org. Preverja names resolve (samo člani iste org),
// baseline/korekcijo, izolacijo druge organizacije in append-only/izroč.
// Poslovna logika createColonyMove NIJE spreminjana (le 2C-3 del).
// ============================================================
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; organizationId?: string | null } },
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
vi.mock("@/lib/tenant-proof", () => ({ ORG_PROOF_HEADER: "x-org-slug-proof", verifyOrgSlug: async () => true }))

import { prisma } from "@/lib/prisma"
import { createColonyMove, correctColonyMove, listColonyMoveDetail } from "@/app/actions/colony-moves"

const EXT = "bee-apiary"
let cb: { id: string; slug: string }
let mk: { id: string; slug: string }
let cbUser: { id: string; name: string | null }
const cleanup: string[] = []

async function mockSessionFor(email: string, slug: string) {
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, organizationId: true } })
  if (!u) throw new Error("ni user")
  let orgId = u.organizationId
  if (!orgId) {
    const m = await prisma.organizationMember.findFirst({ where: { userId: u.id }, orderBy: { isDefault: "desc" }, select: { organizationId: true } })
    orgId = m?.organizationId ?? null
  }
  if (!orgId) throw new Error("brez org")
  state.session = { user: { id: u.id, role: u.role, organizationId: orgId } }
  state.headerEntries = { "x-org-slug": slug }
}

async function rec(orgId: string, entityKey: string, data: Record<string, unknown>) {
  const title = (data.label as string) ?? `${entityKey}-${Date.now()}`
  const r = await prisma.extensionRecord.create({
    data: { organizationId: orgId, extensionId: EXT, entityKey, title, data: data as any },
  })
  cleanup.push(r.id)
  return r
}

beforeAll(async () => {
  const all = await prisma.organization.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true } })
  cb = all.find((o) => o.slug === "cebelar-test") ?? all[0]
  mk = all.find((o) => o.slug === "mehanik-test") ?? all[1]
  cbUser = await prisma.user.findUnique({ where: { email: "cb@f631.test" }, select: { id: true, name: true } }) as { id: string; name: string | null }
})

afterAll(async () => {
  if (cleanup.length) await prisma.extensionRecord.deleteMany({ where: { id: { in: cleanup } } })
  await prisma.$disconnect()
})

describe("FAZA 2C-3 — listColonyMoveDetail (names + izolacija + korekcija)", () => {
  it("vrne zgodovino + imena izvajalcev (člani iste org) in trenutno lokacijo z nazivi", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const A = await rec(cb.id, "hive", { label: "Panj-A" })
    const B = await rec(cb.id, "hive", { label: "Panj-B" })
    const c = await rec(cb.id, "colony", { label: "Kol-D", hive_ref: A.id })
    const r = await createColonyMove({ colonyId: c.id, toHiveId: B.id, movedAt: "2026-05-10T00:00:00Z", reason: "prostor" })
    expect(r.ok).toBe(true)
    const d = await listColonyMoveDetail(c.id)
    expect(d.ok).toBe(true)
    // trenutna lokacija -> B, naziv razrešen
    expect(d.currentHiveId).toBe(B.id)
    expect(d.currentHiveTitle).toBe("Panj-B")
    // 2 dogodka: baseline + selitev
    expect(d.events.length).toBe(2)
    const bl = d.events.find((e) => e.baseline)
    expect(bl).toBeTruthy()
    expect(bl!.toHiveTitle).toBe("Panj-A")
    expect(bl!.movedAt).toBeNull()
    expect(bl!.recordedAt).toBeTruthy()
    const move = d.events.find((e) => !e.baseline)
    expect(move!.toHiveTitle).toBe("Panj-B")
    expect(move!.fromHiveTitle).toBe("Panj-A")
    expect(move!.reason).toBe("prostor")
    expect(move!.movedAt).toContain("2026-05-10")
    // performed_by je iz SEJE (strežniško) in se razreši na ime istega člana
    expect(bl!.performedById).toBe(cbUser.id)
    expect(bl!.performedByName).toBeTruthy() // ime (ne gol id)
  })

  it("tuj uporabnik (ne član) ni razkrit kot ime — prikaže se Neznan", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const A = await rec(cb.id, "hive", { label: "Panj-X" })
    const B = await rec(cb.id, "hive", { label: "Panj-Y" })
    const c = await rec(cb.id, "colony", { label: "Kol-E", hive_ref: A.id })
    // ročno vstavimo dogodek, ki ga je "izvedel" uporabnik druge organizacije (posnetek legacyja)
    const mkUser = await prisma.user.findFirst({ select: { id: true }, where: { email: { not: "cb@f631.test" } } })
    await prisma.extensionRecord.create({
      data: {
        organizationId: cb.id,
        extensionId: EXT,
        entityKey: "colony_move",
        title: "Legacy",
        data: { colony_ref: c.id, to_hive_ref: B.id, moved_at: "2026-01-01T00:00:00Z", recorded_at: "2026-01-01T00:00:00Z", performed_by: mkUser!.id, baseline: true } as any,
      },
    })
    const d = await listColonyMoveDetail(c.id)
    const ev = d.events.find((e) => e.baseline)!
    expect(ev.performedById).toBe(mkUser!.id)
    expect(ev.performedByName).toBeNull() // ne razkriemo imena tujega; UI pokaže "Neznan"
  })

  it("korekcija: original ostane, nov correction dogodek; detajl označi korekcijo in correctsRef", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const A = await rec(cb.id, "hive", { label: "Panj-P" })
    const B = await rec(cb.id, "hive", { label: "Panj-Q" })
    const C = await rec(cb.id, "hive", { label: "Panj-R" })
    const c = await rec(cb.id, "colony", { label: "Kol-F", hive_ref: A.id })
    const r = await createColonyMove({ colonyId: c.id, toHiveId: B.id, movedAt: "2026-06-01T00:00:00Z" })
    expect(r.ok).toBe(true)
    const all = await prisma.extensionRecord.findMany({ where: { organizationId: cb.id, extensionId: EXT, entityKey: "colony_move" }, select: { id: true, data: true } })
    const eventId = all.find((x) => (x.data as any)?.colony_ref === c.id && (x.data as any)?.to_hive_ref === B.id)!.id
    const corr = await correctColonyMove(eventId, { toHiveId: C.id, reason: "napačen panj" })
    expect(corr.ok).toBe(true)
    const d = await listColonyMoveDetail(c.id)
    const corrEv = d.events.find((e) => e.isCorrection)
    expect(corrEv).toBeTruthy()
    expect(corrEv!.correctsRef).toBe(eventId)
    expect(corrEv!.correctionReason).toBe("napačen panj")
    // trenutna lokacija po korekciji = C
    expect(d.currentHiveId).toBe(C.id)
    expect(d.currentHiveTitle).toBe("Panj-R")
    // original še vedno viden (ni izbrisan) — najdemo ga
    expect(d.events.some((e) => e.id === eventId && !e.isCorrection)).toBe(true)
  })

  it("izolacija: detajl tuje družine (druga org) → ok=false", async () => {
    await mockSessionFor("cb@f631.test", cb.slug)
    const foreignColony = await rec(mk.id, "colony", { label: "Tuj-Kol" })
    const d = await listColonyMoveDetail(foreignColony.id)
    expect(d.ok).toBe(false)
  })
})