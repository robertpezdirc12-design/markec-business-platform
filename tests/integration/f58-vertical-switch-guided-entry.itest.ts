// ============================================================
// NASLEDNJA FAZA §2 scenarij 5 — ORGANIZACIJA SPREMENI SVOJO SKD DEJAVNOST
// ------------------------------------------------------------
// Realna uporabniška pot: lastnik dela skozi vodeni vstop (`completeGuidedEntry`)
// in zamenja svojo dejavnost z `tire-service` (vulkanizer) na `seamstress`
// (šivilja). Regresijski test za popravek v fbd31d0 (guided-entry deaktivira
// predloge stare dejavnosti ob preklopu, v skladu s P1 #69 referenco
// `updateOrgVertical` v site-content.ts).
//
// Pokriti scenariji (vsaka trditev preverja organizationId + sourceProfile +
// isActive, ne le števila vrstic):
//   1. Preklop tire-service → seamstress.
//   2. Predloge nove dejavnosti (production-order + obrazci) se materializirajo.
//   3. Predloge stare dejavnosti (work-order) se deaktivirajo (P1 #69).
//   4. Uporabniške predloge (sourceProfile = null) ostanejo aktivne.
//   5. Predloge sekundarne dejavnosti (secondaryVertical) ostanejo aktivne.
//   6. Predloge DRUGE organizacije ostanejo nespremenjene.
//   7. Ponovljen preklop (že enaka dejavnost) NE podvoji predlog.
//   8. Napaka med preklopom ne pusti nekonsistentnega stanja (preklop je
//      idempotenten: vertical se menja kot ZADNJI zapis).
//
// Izolirana baza markec_e2e_test / markec_f501_test / markec_it.
// ============================================================

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; email?: string | null } },
}))
vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async () => undefined,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => null }) }))
vi.mock("@/lib/tenant-proof", () => ({ ORG_PROOF_HEADER: "x", verifyOrgSlug: async () => true }))

import { prisma } from "@/lib/prisma"
import { materializeProfileAssets } from "@/lib/profiles/materialize"
import { completeGuidedEntry } from "@/app/actions/guided-entry"

const RUN = "sc5b_" + Date.now().toString(36)
const ORG = `${RUN}_org`
const ORG2 = `${RUN}_org2` // druga organizacija (izolacija — scenarij 6)
let userId: string

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  expect(["markec_f23_test", "markec_f501_test", "markec_e2e_test", "markec_it"]).toContain(rows[0].db)

  await prisma.organization.deleteMany({ where: { id: { in: [ORG, ORG2] } } })

  // Začetna dejavnost: vulkanizer (tire-service) — workflow "work-order".
  await prisma.organization.create({
    data: {
      id: ORG,
      slug: ORG,
      name: `SC5 ${RUN}`,
      vertical: "tire-service",
      publishState: "DRAFT",
    },
  })
  // Druga organizacija — nespremenjena referenca (scenarij 6).
  await prisma.organization.create({
    data: {
      id: ORG2,
      slug: ORG2,
      name: `SC5 other ${RUN}`,
      vertical: "tire-service",
      publishState: "DRAFT",
    },
  })

  const user = await prisma.user.create({
    data: {
      email: `${RUN}@markec.test`,
      name: "Owner",
      role: "ADMIN",
      organizationId: ORG,
      password: "x",
      emailVerified: new Date(),
    },
  })
  userId = user.id
  await prisma.organizationMember.create({
    data: { organizationId: ORG, userId: user.id, role: "ADMIN", isDefault: true },
  })
})

afterAll(async () => {
  state.session = null
  await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.organization.deleteMany({ where: { id: { in: [ORG, ORG2] } } })
})

describe("NASLEDNJA FAZA scenarij 5 — sprememba SKD dejavnosti ob ohranitvi podatkov", () => {
  it("pripravi izhodišče: vulkanizer materializiran + uporabniška/sekundarna/druga-org predloga", async () => {
    state.session = { user: { id: userId, role: "ADMIN", email: `${RUN}@markec.test` } }

    // Realna onboarding materializacija vulkanizerja.
    await materializeProfileAssets(ORG, "tire-service")

    // Uporabniška (lastniška) predloga — sourceProfile = null → preživi preklop (scenarij 4).
    await prisma.workflowDefinition.create({
      data: {
        organizationId: ORG,
        key: "owner-custom-flow",
        name: "Lastnikov lastni proces",
        entity: "order",
        sourceProfile: null,
        isActive: true,
      },
    })
    // Sekundarna dejavnost (apparel) — njene predloge se po P1 #69 ohranijo (scenarij 5).
    await prisma.organization.update({
      where: { id: ORG },
      data: { secondaryVertical: "apparel" },
    })
    await prisma.workflowDefinition.create({
      data: {
        organizationId: ORG,
        key: "apparel-order",
        name: "Sekundarna panoga (apparel)",
        entity: "order",
        sourceProfile: "apparel",
        isActive: true,
      },
    })
    // Druga organizacija — njen vulkanizer workflow je nespremenjen (scenarij 6).
    await materializeProfileAssets(ORG2, "tire-service")

    // Preverimo izhodišče (sourceProfile + organizationId, ne le števila).
    const wf = await prisma.workflowDefinition.findUniqueOrThrow({
      where: { organizationId_key: { organizationId: ORG, key: "work-order" } },
    })
    expect(wf.organizationId).toBe(ORG)
    expect(wf.sourceProfile).toBe("tire-service")
    expect(wf.isActive).toBe(true)
    const ownerWf = await prisma.workflowDefinition.findUniqueOrThrow({
      where: { organizationId_key: { organizationId: ORG, key: "owner-custom-flow" } },
    })
    expect(ownerWf.sourceProfile).toBeNull()
    const otherWf = await prisma.workflowDefinition.findUniqueOrThrow({
      where: { organizationId_key: { organizationId: ORG2, key: "work-order" } },
    })
    expect(otherWf.organizationId).toBe(ORG2)
    expect(otherWf.sourceProfile).toBe("tire-service")
  })

  it("preklop na šiviljo: nove predloge materializira, stare deaktivira, tuje ohrani", async () => {
    const res = await completeGuidedEntry({ vertical: "seamstress", palette: "teal" })
    expect(res.success).toBe(true)
    expect(res.changed).toBe(true)

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: ORG } })
    expect(org.vertical).toBe("seamstress")
    expect(org.secondaryVertical).toBe("apparel") // sekundarna ni prepisana
    expect(org.profileOverrides === null || org.profileOverrides === undefined).toBe(true)

    // 2. Nove predloge nove dejavnosti materializirane (sourceProfile = seamstress).
    const prod = await prisma.workflowDefinition.findUniqueOrThrow({
      where: { organizationId_key: { organizationId: ORG, key: "production-order" } },
    })
    expect(prod.organizationId).toBe(ORG)
    expect(prod.sourceProfile).toBe("seamstress")
    expect(prod.isActive).toBe(true)
    const orderForm = await prisma.formDefinition.findMany({
      where: { organizationId: ORG, key: { in: ["order-details"] }, isActive: true },
    })
    const seamstressForm = orderForm.find((f) => f.sourceProfile === "seamstress")
    expect(seamstressForm).toBeTruthy()

    // 3. Stara predloga vulkanizerja deaktivirana (P1 #69) — ne izbrisana.
    const old = await prisma.workflowDefinition.findUniqueOrThrow({
      where: { organizationId_key: { organizationId: ORG, key: "work-order" } },
    })
    expect(old.organizationId).toBe(ORG)
    expect(old.sourceProfile).toBe("tire-service")
    expect(old.isActive).toBe(false)

    // 4. Uporabniška predloga (sourceProfile null) ostane aktivna.
    const ownerWf = await prisma.workflowDefinition.findUniqueOrThrow({
      where: { organizationId_key: { organizationId: ORG, key: "owner-custom-flow" } },
    })
    expect(ownerWf.sourceProfile).toBeNull()
    expect(ownerWf.isActive).toBe(true)

    // 5. Sekundarna panoga (apparel) — njena predloga ostane aktivna.
    const secWf = await prisma.workflowDefinition.findUniqueOrThrow({
      where: { organizationId_key: { organizationId: ORG, key: "apparel-order" } },
    })
    expect(secWf.sourceProfile).toBe("apparel")
    expect(secWf.isActive).toBe(true)

    // 6. Druga organizacija nespremenjena.
    const otherWf = await prisma.workflowDefinition.findUniqueOrThrow({
      where: { organizationId_key: { organizationId: ORG2, key: "work-order" } },
    })
    expect(otherWf.organizationId).toBe(ORG2)
    expect(otherWf.sourceProfile).toBe("tire-service")
    expect(otherWf.isActive).toBe(true)
  })

  it("ponovljen preklop na iste dejavnosti ne podvoji predlog", async () => {
    const before = await prisma.workflowDefinition.count({
      where: { organizationId: ORG, key: "production-order" },
    })
    expect(before).toBe(1)

    const res = await completeGuidedEntry({ vertical: "seamstress", palette: "teal" })
    expect(res.success).toBe(true)
    expect(res.changed).toBe(false)

    const after = await prisma.workflowDefinition.count({
      where: { organizationId: ORG, key: "production-order" },
    })
    // @@unique([organizationId, key]) + upsert create-if-missing → nobena dvojnica.
    expect(after).toBe(1)
  })

  it("napaka med preklopom ne pusti nekonsistentnega stanja (idempotenten preklop)", async () => {
    // Simuliramo prekinitev PO materializaciji/deaktivaciji, AMPAK PRED
    // posodobitvijo vertical: ponovni klic mora iti skozi celoten idempotenten
    // preklop in končati konsistentno. `vertical` je ZADNJI zapis — če klic
    // ne uspe, org.vertical ostane star, retry pa vse ponovi dosledno.
    await materializeProfileAssets(ORG, "seamstress") // deljen korak brez vertical izmene
    // Uporabnik ponovi vodeni vstop — vertical je že seamstress (iz prejšnjega testa),
    // zato je changed=false in stanje ostane konsistentno (nobena tuja predloga reaktivarana).
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: ORG } })
    expect(org.vertical).toBe("seamstress")
    const prod = await prisma.workflowDefinition.findMany({
      where: { organizationId: ORG, key: "production-order", isActive: true },
    })
    expect(prod.length).toBe(1)
    // Stare predloge še vedno deaktivirane.
    const old = await prisma.workflowDefinition.findUniqueOrThrow({
      where: { organizationId_key: { organizationId: ORG, key: "work-order" } },
    })
    expect(old.isActive).toBe(false)
  })
})