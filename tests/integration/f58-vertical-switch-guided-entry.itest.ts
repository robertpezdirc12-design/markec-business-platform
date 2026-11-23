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
//   8. Napaka med preklopom se samozdravi ob ponovitvi: vertica je ZADNJI zapis,
//      zato prekinitev pusti org.vertical nedotaknjen (star), ponovljen klic pa
//      vse dosledno uskladi brez dvojnic in brez puščanja aktivnih starih predlog.
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
const ORG3 = `${RUN}_org3` // za test napake med preklopom (scenarij 8)
let userId: string
let userId3: string

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  expect(["markec_f23_test", "markec_f501_test", "markec_e2e_test", "markec_it"]).toContain(rows[0].db)

  await prisma.organization.deleteMany({ where: { id: { in: [ORG, ORG2, ORG3] } } })

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
  // Organizacija za test napake med preklopom (scenarij 8) — izoliran.
  await prisma.organization.create({
    data: {
      id: ORG3,
      slug: ORG3,
      name: `SC5 fail ${RUN}`,
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

  const user3 = await prisma.user.create({
    data: {
      email: `${RUN}@markec.fail.test`,
      name: "Owner3",
      role: "ADMIN",
      organizationId: ORG3,
      password: "x",
      emailVerified: new Date(),
    },
  })
  userId3 = user3.id
  await prisma.organizationMember.create({
    data: { organizationId: ORG3, userId: user3.id, role: "ADMIN", isDefault: true },
  })
})

afterAll(async () => {
  state.session = null
  await prisma.user.deleteMany({ where: { id: { in: [userId, userId3] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [ORG, ORG2, ORG3] } } })
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

  it("napaka med preklopom se samozdravi ob ponovitvi (vertical = zadnji zapis)", async () => {
    // ORGANIZACIJA ORG3 (izolirana): začetni vulkanizer + materializiran work-order.
    state.session = { user: { id: userId3, role: "ADMIN", email: `${RUN}@markec.fail.test` } }
    await materializeProfileAssets(ORG3, "tire-service")
    await prisma.organization.update({ where: { id: ORG3 }, data: { vertical: "tire-service" } })

    // Napaka PO materializaciji novih predlog, AMPAK PRED zapisom vertical:
    // prisilimo `organization.update({ data: { vertical } })` na ponovno. Tip
    // `data.vertical` določa izključno vodeni preklop (NE profileVersion v
    // materializeProfileAssets, ki ima samo `data.profileVersion`).
    // Ohranimo sklic na izvirno metodo pred spyingem, da delegiramo brez rekurzije.
    const orgUpdate = prisma.organization.update.bind(prisma.organization)
    const spy = vi.spyOn(prisma.organization, "update")
    spy.mockImplementation((args) => {
      const data = args.data as { vertical?: string }
      if (data.vertical) throw new Error("SC5_INJECTED_FAILURE")
      return orgUpdate(args)
    })

    const failed = await completeGuidedEntry({ vertical: "seamstress", palette: "teal" })
    // Preklop se konča z napako; guided-entry varno vrne sanitizirano (generičen)
    // error sporočilo, ne razkrije notranjega podatka — to samo potrjuje catch vejo.
    expect(failed.success).toBe(false)
    expect(String(failed.error)).toBeTruthy()

    // Vertical je ZADNJI zapis → po napaki ostane star (tire-service).
    const orgAfterFail = await prisma.organization.findUniqueOrThrow({ where: { id: ORG3 } })
    expect(orgAfterFail.vertical).toBe("tire-service")
    // Materializacija je vmes že zagnala → production-order je aktiven (začasno);
    // to je dokumentiran vmesni (prehodni) vrzel, ki ga retry uskladi.
    const partialProd = await prisma.workflowDefinition.findMany({
      where: { organizationId: ORG3, key: "production-order", isActive: true },
    })
    expect(partialProd.length).toBe(1)

    // RETRY — isti lastnik ponovi vodeni vstop.
    spy.mockRestore()
    const retry = await completeGuidedEntry({ vertical: "seamstress", palette: "teal" })
    expect(retry.success).toBe(true)
    expect(retry.changed).toBe(true)

    const orgFinal = await prisma.organization.findUniqueOrThrow({ where: { id: ORG3 } })
    expect(orgFinal.vertical).toBe("seamstress")
    // Nobena dvojnica: točno ena aktivna production-order vrstica.
    const prodFinal = await prisma.workflowDefinition.findMany({
      where: { organizationId: ORG3, key: "production-order", isActive: true },
    })
    expect(prodFinal.length).toBe(1)
    // Stara predloga (work-order) deaktivirana — nobeno puščanje aktivne.
    const oldFinal = await prisma.workflowDefinition.findUniqueOrThrow({
      where: { organizationId_key: { organizationId: ORG3, key: "work-order" } },
    })
    expect(oldFinal.isActive).toBe(false)
  })
})