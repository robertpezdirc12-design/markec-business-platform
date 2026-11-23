// ============================================================
// PR #142 / SKD-678 §5b — workOrders: MATERIALIZACIJA, NE deklaracija
// ------------------------------------------------------------
// Prej sva delovni nalog dokazala le z ročno sesano workflowDefinition
// (seedWorkflow) — to NIKJER ne poveže deklarirane workflow predloge profila
// z dejanskim tenant-workflowom. Ta itest poganja REALNO materializacijo
// (`seedOrganizationCatalog` + `materializeProfileAssets`), preveri, da profil
// z `workflows` (npr. tire-service) dobi tenant `workflowDefinition` s
// stopnjami, in da `createWorkOrder` potem USPE. Negativni del dokaže, da
// profil z `workOrders: required` in `workflows: []` (skd-a-agriculture)
// NI omejen kot runtime-materializiran → `createWorkOrder` vrne `NO_WORKFLOW`.
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
import { seedOrganizationCatalog } from "@/lib/verticals-seed"
import { materializeProfileAssets } from "@/lib/profiles/materialize"
import { getProfile } from "@/lib/profiles/registry"
import { createWorkOrder, createFirstWorkflowDefinition } from "@/app/actions/work-orders"
import { createFormDefinition, listFormDefinitions } from "@/app/actions/forms"

const RUN = "wom_" + Date.now().toString(36)
const POS = `${RUN}_pos` // tire-service (workflows: 1, entity "order", 7 stages)
const NEG = `${RUN}_neg` // skd-a-agriculture (workOrders: required, workflows: [])
const FORMS = `${RUN}_forms` // skd-l-finance (forms: required, forms: [])
let userId: string
let negUserId: string
let formsUserId: string

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  expect(["markec_f23_test", "markec_f501_test", "markec_e2e_test", "markec_it"]).toContain(rows[0].db)

  await prisma.organization.deleteMany({ where: { id: { in: [POS, NEG] } } })

  // ===== Pozitivni org: tire-service — deklarirana workflow predloga = 1 (entity "order") =====
  await prisma.organization.create({
    data: {
      id: POS,
      slug: POS,
      name: `WOM A ${RUN}`,
      vertical: "tire-service",
      publishState: "DRAFT",
    },
  })
  // ===== Negativni org: skd-a-agriculture — workOrders: required, a workflows: [] =====
  await prisma.organization.create({
    data: {
      id: NEG,
      slug: NEG,
      name: `WOM B ${RUN}`,
      vertical: "skd-a-agriculture",
      publishState: "DRAFT",
    },
  })
  await prisma.organization.create({
    data: {
      id: FORMS,
      slug: FORMS,
      name: `WOM C ${RUN}`,
      vertical: "skd-l-finance",
      publishState: "DRAFT",
    },
  })

  const user = await prisma.user.create({
    data: {
      email: `${RUN}@markec.test`,
      name: "Owner",
      role: "ADMIN",
      organizationId: POS,
      password: "x",
      emailVerified: new Date(),
    },
  })
  userId = user.id
  await prisma.organizationMember.create({
    data: { organizationId: POS, userId: user.id, role: "ADMIN", isDefault: true },
  })
  await prisma.organizationMember.create({
    data: { organizationId: NEG, userId: user.id, role: "ADMIN" },
  })
  state.session = { user: { id: user.id, role: "ADMIN", email: user.email } }

  // Ločeni uporabnik, katerega default članstvo je NEG (da createWorkOrder v
  // negativnem testu velja za organizacijo BREZ workflow energije).
  const negUser = await prisma.user.create({
    data: {
      email: `${RUN}-neg@markec.test`,
      name: "NEG Owner",
      role: "ADMIN",
      organizationId: NEG,
      password: "x",
      emailVerified: new Date(),
    },
  })
  negUserId = negUser.id
  await prisma.organizationMember.create({
    data: { organizationId: NEG, userId: negUser.id, role: "ADMIN", isDefault: true },
  })

  const formsUser = await prisma.user.create({
    data: {
      email: `${RUN}-forms@markec.test`,
      name: "Forms Owner",
      role: "ADMIN",
      organizationId: FORMS,
      password: "x",
      emailVerified: new Date(),
    },
  })
  formsUserId = formsUser.id
  await prisma.organizationMember.create({
    data: { organizationId: FORMS, userId: formsUser.id, role: "ADMIN", isDefault: true },
  })
})

afterAll(async () => {
  await prisma.organization.deleteMany({
    where: { id: { in: [POS, NEG, FORMS] } },
  }).catch(() => undefined)
  await prisma.user
    .deleteMany({ where: { id: { in: [userId, negUserId, formsUserId] } } })
    .catch(() => undefined)
  await prisma.$disconnect()
})

describe("PR #142 §5b — workOrders materializacija (ne le deklaracija)", () => {
  it("tire-service: deklarirana workflow -> materializirana v tenant-workflow s stopnjami, createWorkOrder USPE", async () => {
    const profile = getProfile("tire-service")
    expect(profile.workflows.length).toBeGreaterThan(0) // predloga obstaja

    await seedOrganizationCatalog(POS, "tire-service")
    const res = await materializeProfileAssets(POS, "tire-service")
    expect(res.workflows).toBe(profile.workflows.length)

    // Preveri dejanski tenant-workflow, ki ga je materializacija NAREDILA.
    const wfs = await prisma.workflowDefinition.findMany({
      where: { organizationId: POS, isActive: true },
      include: { stages: { orderBy: { order: "asc" } } },
    })
    const entityOrder = wfs.find((w) => w.entity === "order")
    expect(entityOrder, "workOrders: required profile mora dobiti entity='order' workflow").toBeDefined()
    expect(entityOrder!.isActive).toBe(true)
    expect(entityOrder!.sourceProfile).toBe("tire-service")
    expect(entityOrder!.stages.length).toBeGreaterThan(0)
    // 7 stopenj iz predloge profile (checkin..closed), brez ročnega seedanja.
    expect(entityOrder!.stages.length).toBe(7)
    expect(entityOrder!.stages[0].key).toBe("checkin")

    // Zdaj ustvari work order na DEJANSKO materializiranem tenant-workflowu.
    const wo = await createWorkOrder({ title: "Menjava gum (materializiran profil)" })
    expect(wo.ok).toBe(true)
    expect(wo.id).toBeTruthy()
    const created = await prisma.workOrder.findUnique({
      where: { id: wo.id! },
      select: { currentStageKey: true, workflowDefinitionId: true, status: true },
    })
    expect(created!.currentStageKey).toBe("checkin")
    expect(created!.workflowDefinitionId).toBe(entityOrder!.id)
    expect(created!.status).toBe("OPEN")
  })

  it("skd-a-agriculture: workOrders REQUIRED, a workflows [] -> NI tenant-workflowa, createWorkOrder = NO_WORKFLOW", async () => {
    const profile = getProfile("skd-a-agriculture")
    expect(profile.capabilities.workOrders).toBe("required")
    expect(profile.workflows?.length ?? 0).toBe(0)

    await seedOrganizationCatalog(NEG, "skd-a-agriculture")
    const res = await materializeProfileAssets(NEG, "skd-a-agriculture")
    expect(res.workflows).toBe(0) // nobena predloga → nič se ne materializira v workflow

    const wfArr = await prisma.workflowDefinition.findMany({ where: { organizationId: NEG } })
    expect(wfArr.length).toBe(0)

    // izvedba s session, katere default članstvo je NEG (brez workflow energije):
    // iskrena negativna preverba, da createWorkOrder na takem org ne uspe.
    const prevSession = state.session
    state.session = { user: { id: negUserId, role: "ADMIN", email: `${RUN}-neg@markec.test` } }
    try {
      const wo = await createWorkOrder({ title: "Nalog brez workflow predloge" })
      expect(wo.ok).toBe(false)
      expect(wo.error).toBe("NO_WORKFLOW")
    } finally {
      state.session = prevSession
    }
  })

  it("createFirstWorkflowDefinition zapolni mrtvo točko (skd-a-agriculture): lastniški proces -> createWorkOrder zdaj USPE", async () => {
    // Nadaljuje tam, kjer je prejšnji test ustavil: NEG ima še vedno
    // workOrders=required, a nič workflow predlog -> ustvari se lastniški proces.
    const prevSession = state.session
    state.session = { user: { id: negUserId, role: "ADMIN", email: `${RUN}-neg@markec.test` } }
    try {
      // Kljub aktivnemu modulu ni nobenega procesa -> createFirstWorkflow ustvari prvega.
      const res = await createFirstWorkflowDefinition()
      expect(res.ok).toBe(true)
      expect(res.definitionId).toBeTruthy()

      const wf = await prisma.workflowDefinition.findUnique({
        where: { id: res.definitionId! },
        include: { stages: { orderBy: { order: "asc" } } },
      })
      expect(wf).toBeDefined()
      // Lastniški proces: sourceProfile = null (NE profilna predloga).
      expect(wf!.sourceProfile).toBeNull()
      expect(wf!.isActive).toBe(true)
      expect(wf!.entity).toBe("order")
      // Ena strukturna stopnja, da createWorkOrder sploh deluje (stages>0).
      expect(wf!.stages.length).toBeGreaterThan(0)

      // Idempotentnost: ponovni klic ne sme ustvariti duplikata (EXISTS).
      const dup = await createFirstWorkflowDefinition()
      expect(dup.ok).toBe(false)
      expect(dup.error).toBe("EXISTS")

      // Mrtva točka zaprta: sedaj lahko lastnik ustvari delovno naročilo.
      const wo = await createWorkOrder({ title: "Prvi delovni nalog po ustvarjenem procesu" })
      expect(wo.ok).toBe(true)
      expect(wo.id).toBeTruthy()
      const created = await prisma.workOrder.findUnique({
        where: { id: wo.id! },
        select: { currentStageKey: true, workflowDefinitionId: true },
      })
      expect(created!.workflowDefinitionId).toBe(wf!.id)
      // Trenutna stopnja = edina strukturna stopnja ustvarjenega procesa.
      expect(created!.currentStageKey).toBe(wf!.stages[0].key)
    } finally {
      state.session = prevSession
    }
  })

  it("createFormDefinition zapolni mrtvo točko (skd-l-finance): lastniški osnutek -> UI vstopna točka za prvi obrazec", async () => {
    // skd-l-finance: forms=required, forms=[] -> modul ACTIVE, a brez definicij
    // in doslej ni bilo UI vstopne točke za prvi obrazec (ni createFormDefinition).
    const profile = getProfile("skd-l-finance")
    expect(profile.capabilities.forms).toBe("required")
    expect(profile.forms.length).toBe(0) // predhodna dejstva: ni materializiranih definicij

    // Izhodišče: NOBENEGA obrazca (še noben lastniški niti profilni).
    const before = await prisma.formDefinition.findMany({
      where: { organizationId: FORMS },
      select: { id: true },
    })
    expect(before.length).toBe(0)

    const prevSession = state.session
    state.session = {
      user: { id: formsUserId, role: "ADMIN", email: `${RUN}-forms@markec.test` },
    }
    try {
      const res = await createFormDefinition({ name: "Povpraševanje" })
      expect(res.ok).toBe(true)
      expect(res.definitionId).toBeTruthy()

      const def = await prisma.formDefinition.findUnique({ where: { id: res.definitionId! } })
      expect(def).toBeDefined()
      // Lastniški OSNUTEK: sourceProfile=null (se ohrani prek preklopov dejavnosti),
      // isActive=false (osnutek — NE javno viden), 0 polj (lastnik doda svoja).
      expect(def!.sourceProfile).toBeNull()
      expect(def!.isActive).toBe(false)
      expect(def!.fields).toEqual([])
      expect(def!.name).toBe("Povpraševanje")

      // Idempotentnost: novi lastniški osnutek prepreči ponovno ustvarjanje.
      const dup = await createFormDefinition({ name: "Duplikat" })
      expect(dup.ok).toBe(false)
      expect(dup.error).toBe("EXISTS")

      // Osnutek ni viden na javni strani (getPublicForms vrača le isActive: true),
      // vendar je definicija prisotna v admin seznamu (vstopna točka obstaja).
      const listed = await listFormDefinitions()
      expect(listed.some((d) => d.id === res.definitionId)).toBe(true)
    } finally {
      state.session = prevSession
    }
  })
})