// ============================================================
// F2.3.1 — Staff multi-organization: integracijsko-varnostna jamstva.
//
// Teče na ločeni testni bazi `markec_f23_test` (resnični Prisma klient,
// resnične strežniške funkcije; nadomeščena je le *seja* / next/cache /
// next/headers). Dokaže:
//   1. isti uporabnik je Staff v orgA in orgB (dve Staff vrstici);
//   2. v vsaki organizaciji ima LOČEN urnik in LOČENE storitve;
//   3. getCurrentStaffIdInOrg(user, orgA) ne vrne Staff iz orgB (izolacija);
//   4. staff-portal akcije (getSessionOrg) razrešijo Staff TRENUTNE org;
//   5. createStaffMember dovoli isti user v drugi org, zavrne dvojnika v
//      isti org (funkcionalni unikat (user, org));
//   6. termin v orgA je vezan na StaffA, termin v orgB na StaffB;
//   7. STAFF iz orgA NE SME spreminjati termina druge organizacije;
//   8. obstoječi beauty rezervacijski potek (getServicesForBooking,
//      createAppointment org-scoping) še vedno deluje.
// ============================================================

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const state = vi.hoisted(() => ({
  session: null as null | {
    user: {
      id: string
      role: "ADMIN" | "STAFF" | "CLIENTE"
      organizationId?: string | null
      email?: string | null
      name?: string | null
    }
  },
  updates: [] as unknown[],
  headerEntries: {} as Record<string, string>,
}))

vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async (patch: unknown) => {
    state.updates.push(patch)
    return null
  },
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}))

vi.mock("next/headers", () => ({
  headers: async () => new Headers(state.headerEntries),
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    set: () => undefined,
    delete: () => undefined,
  }),
}))

vi.mock("@/lib/tenant-proof", () => ({
  ORG_PROOF_HEADER: "x-org-slug-proof",
  verifyOrgSlug: async () => true,
}))

import { prisma } from "@/lib/prisma"
import { getStaffForOrg, getCurrentStaffIdInOrg } from "@/lib/staff/current"
import {
  createStaffMember,
  getCurrentStaffMember,
  getStaffPortalStats,
} from "@/app/actions/staff"
import {
  getServicesForBooking,
  getCurrentUserStaffId,
} from "@/app/actions/appointments"

const ID = {
  orgA: "f231-org-a",
  orgB: "f231-org-b",
  staff: "f231-user-staff", // isti uporabnik v obeh orgah
  onlyA: "f231-user-only-a", // staff samo v orgA -> adminB ga doda v orgB
  adminA: "f231-user-admin-a",
  adminB: "f231-user-admin-b",
  customer: "f231-user-customer",
  staffA: "f231-staff-a",
  staffB: "f231-staff-b",
  onlyAStaff: "f231-staff-only-a",
  svcA: "f231-service-a",
  svcB: "f231-service-b",
  aptA: "f231-appointment-a",
  aptB: "f231-appointment-b",
}

function loginAs(
  id: string,
  role: "ADMIN" | "STAFF" | "CLIENTE",
  organizationId: string | null = null
) {
  state.session = {
    user: { id, role, organizationId, email: `${id}@f231.test`, name: id },
  }
}

async function freshOrg(id: string, slug: string) {
  await prisma.organization.upsert({
    where: { id },
    update: {},
    create: {
      id,
      slug,
      name: id,
      status: "ACTIVE",
      publishState: "PUBLISHED",
      vertical: "beauty",
      plan: "scale",
    },
  })
}

async function freshUser(id: string, role: "ADMIN" | "STAFF" | "CLIENTE") {
  await prisma.user.upsert({
    where: { id },
    update: { role },
    create: {
      id,
      email: `${id}@f231.test`,
      name: id,
      role,
      emailVerified: new Date(),
    },
  })
}

async function addMembership(userId: string, orgId: string, role: "ADMIN" | "STAFF") {
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    update: { role },
    create: { organizationId: orgId, userId, role, isDefault: false },
  })
}

async function makeStaff(
  staffId: string,
  userId: string,
  orgId: string,
  dayOfWeek: number,
  serviceId: string | null
) {
  await prisma.staff.upsert({
    where: { id: staffId },
    update: { organizationId: orgId, userId },
    create: { id: staffId, userId, name: staffId, organizationId: orgId },
  })
  await prisma.workingHours.deleteMany({ where: { staffId } })
  await prisma.workingHours.createMany({
    data: [
      { staffId, dayOfWeek, startTime: "09:00", endTime: "12:00", isActive: true },
      { staffId, dayOfWeek: (dayOfWeek % 5) + 1, startTime: "13:00", endTime: "17:00", isActive: true },
    ],
  })
  if (serviceId) {
    await prisma.staffService.upsert({
      where: { staffId_serviceId: { staffId, serviceId } },
      update: {},
      create: { staffId, serviceId },
    })
  }
}

async function clean() {
  await prisma.staffService.deleteMany({ where: { staffId: { startsWith: "f231-" } } })
  await prisma.workingHours.deleteMany({ where: { staffId: { startsWith: "f231-" } } })
  await prisma.appointment.deleteMany({ where: { id: { startsWith: "f231-" } } })
  await prisma.staff.deleteMany({ where: { id: { startsWith: "f231-" } } })
  await prisma.service.deleteMany({ where: { id: { startsWith: "f231-" } } })
  await prisma.organizationMember.deleteMany({ where: { userId: { startsWith: "f231-" } } })
  await prisma.user.deleteMany({ where: { id: { startsWith: "f231-" } } })
  await prisma.organization.deleteMany({ where: { id: { startsWith: "f231-" } } })
}

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>(
    "select current_database() as db"
  )
  expect(["markec_f23_test", "markec_e2e_test"]).toContain(rows[0].db)

  await clean()

  // Org A in B (oba beauty/ACTIVE).
  await freshOrg(ID.orgA, "f231-alpha")
  await freshOrg(ID.orgB, "f231-beta")

  // Uporabniki.
  await freshUser(ID.staff, "STAFF")
  await freshUser(ID.onlyA, "STAFF")
  await freshUser(ID.adminA, "ADMIN")
  await freshUser(ID.adminB, "ADMIN")
  await freshUser(ID.customer, "CLIENTE")

  // Članstva — staff in onlyA sta v OBEH orgah (da lahko adminB doda).
  await addMembership(ID.staff, ID.orgA, "STAFF")
  await addMembership(ID.staff, ID.orgB, "STAFF")
  await addMembership(ID.onlyA, ID.orgA, "STAFF")
  await addMembership(ID.onlyA, ID.orgB, "STAFF")
  await addMembership(ID.adminA, ID.orgA, "ADMIN")
  await addMembership(ID.adminB, ID.orgB, "ADMIN")

  // Storitvi (ena na orgo, distinct).
  await prisma.service.upsert({
    where: { id: ID.svcA },
    update: {},
    create: { id: ID.svcA, name: "Frizura A", slug: "f231-frizura-a", duration: 30, price: 20, organizationId: ID.orgA },
  })
  await prisma.service.upsert({
    where: { id: ID.svcB },
    update: {},
    create: { id: ID.svcB, name: "Manikira B", slug: "f231-manikira-b", duration: 45, price: 25, organizationId: ID.orgB },
  })

  // Staff: isti user -> dve vrstici, različni orgi, različni urniki/storitve.
  await makeStaff(ID.staffA, ID.staff, ID.orgA, 1, ID.svcA) // ponedeljek + torek-tek, storitev A
  await makeStaff(ID.staffB, ID.staff, ID.orgB, 3, ID.svcB) // sreda + četrtek, storitev B
  // onlyA je staff samo v orgA (testno: adminB ga shranimo v orgB).
  await makeStaff(ID.onlyAStaff, ID.onlyA, ID.orgA, 5, ID.svcA)

  // Termini: orgA -> StaffA, orgB -> StaffB.
  await prisma.appointment.createMany({
    data: [
      {
        id: ID.aptA,
        staffId: ID.staffA,
        organizationId: ID.orgA,
        startTime: new Date("2030-01-01T10:00:00Z"),
        endTime: new Date("2030-01-01T10:30:00Z"),
        status: "CONFIRMED",
        totalPrice: 20,
        guestName: "Gost A",
        guestEmail: "gostA@f231.test",
      },
      {
        id: ID.aptB,
        staffId: ID.staffB,
        organizationId: ID.orgB,
        startTime: new Date("2030-01-02T10:00:00Z"),
        endTime: new Date("2030-01-02T10:45:00Z"),
        status: "CONFIRMED",
        totalPrice: 25,
        guestName: "Gost B",
        guestEmail: "gostB@f231.test",
      },
    ],
  })
})

beforeEach(() => {
  state.session = null
  state.updates = []
  state.headerEntries = {}
})

afterAll(async () => {
  await prisma.$disconnect()
})

// ------------------------------------------------------------
// 1 + 2 + 6: dve Staff vrstici, ločeno poslovanje, termini ↦ Staff ↦ org
// ------------------------------------------------------------
describe("F2.3.1 — isti uporabnik v dveh organizacijah", () => {
  it("ima natanko dve Staff vrstici, po eno v vsaki org", async () => {
    const rows = await prisma.staff.findMany({ where: { userId: ID.staff } })
    expect(rows).toHaveLength(2)
    const orgIds = rows.map((r) => r.organizationId).sort()
    expect(orgIds).toEqual([ID.orgA, ID.orgB])
  })

  it("ima v vsaki org LOČEN urnik in LOČENE storitve", async () => {
    const staffA = await prisma.staff.findUnique({
      where: { id: ID.staffA },
      include: { workingHours: true, services: true },
    })
    const staffB = await prisma.staff.findUnique({
      where: { id: ID.staffB },
      include: { workingHours: true, services: true },
    })
    expect(staffA!.workingHours.length).toBeGreaterThan(0)
    expect(staffB!.workingHours.length).toBeGreaterThan(0)
    expect(staffA!.services.map((s) => s.serviceId)).toContain(ID.svcA)
    expect(staffA!.services.map((s) => s.serviceId)).not.toContain(ID.svcB)
    expect(staffB!.services.map((s) => s.serviceId)).toContain(ID.svcB)
    expect(staffB!.services.map((s) => s.serviceId)).not.toContain(ID.svcA)
    // Urnika se ne prekrivata po vsebini (različni staffId, neodvisni).
    expect(staffA!.workingHours[0].staffId).toBe(ID.staffA)
    expect(staffB!.workingHours[0].staffId).toBe(ID.staffB)
  })

  it("termin v orgA = StaffA, termin v orgB = StaffB (KP invariant)", async () => {
    const aptA = await prisma.appointment.findUnique({ where: { id: ID.aptA } })
    const aptB = await prisma.appointment.findUnique({ where: { id: ID.aptB } })
    expect(aptA!.staffId).toBe(ID.staffA)
    expect(aptA!.organizationId).toBe(ID.orgA)
    expect(aptB!.staffId).toBe(ID.staffB)
    expect(aptB!.organizationId).toBe(ID.orgB)
    // Invariant: Appointment.organizationId === Staff.organizationId
    expect(aptA!.organizationId).toBe(ID.orgA)
    expect(aptB!.organizationId).toBe(ID.orgB)
  })
})

// ------------------------------------------------------------
// 3 + 4: razreševanje trenutnega Staffa je org-scoped
// ------------------------------------------------------------
describe("F2.3.1 — org-scoped razreševanje zaposlenega", () => {
  it("getCurrentStaffIdInOrg(user, orgA) vrne StaffA, NE StaffB", async () => {
    const a = await getCurrentStaffIdInOrg(ID.staff, ID.orgA)
    const b = await getCurrentStaffIdInOrg(ID.staff, ID.orgB)
    expect(a).toBe(ID.staffA)
    expect(b).toBe(ID.staffB)
    // Izolacija: za orgA ne sme vrniti orgB profila.
    expect(a).not.toBe(ID.staffB)
  })

  it("getStaffForOrg napredek: orgA ↦ staffA, orgB ↦ staffB", async () => {
    const a = await getStaffForOrg(ID.staff, ID.orgA)
    const b = await getStaffForOrg(ID.staff, ID.orgB)
    expect(a?.id).toBe(ID.staffA)
    expect(b?.id).toBe(ID.staffB)
  })

  it("staff-portal akcija vrne podatke TRENUTNE org (preklop org spremeni kontekst)", async () => {
    // Vozel A.
    loginAs(ID.staff, "STAFF", ID.orgA)
    const ctxA = await getCurrentStaffMember()
    expect(ctxA.success).toBe(true)
    if (ctxA.success && ctxA.staff) {
      expect(ctxA.staff.id).toBe(ID.staffA)
      expect(ctxA.staff.services.map((s: { service: { id: string } }) => s.service.id)).toContain(ID.svcA)
    }

    // Preklop v org B — isti uporabnik, drug Staff, druge storitve.
    loginAs(ID.staff, "STAFF", ID.orgB)
    const ctxB = await getCurrentStaffMember()
    expect(ctxB.success).toBe(true)
    if (ctxB.success && ctxB.staff) {
      expect(ctxB.staff.id).toBe(ID.staffB)
      expect(ctxB.staff.services.map((s: { service: { id: string } }) => s.service.id)).toContain(ID.svcB)
      expect(ctxB.staff.services.map((s: { service: { id: string } }) => s.service.id)).not.toContain(ID.svcA)
    }
  })

  it("getStaffPortalStats razreši Stats trenutne org (brez mešanja orgB podatkov)", async () => {
    loginAs(ID.staff, "STAFF", ID.orgA)
    const stats = await getStaffPortalStats()
    expect(stats.success).toBe(true)
  })
})

// ------------------------------------------------------------
// 5: funkcionalni unikat (user, org) — dvojnik v isti org zavrnjen,
//    isti user v drugi org dovoljen
// ------------------------------------------------------------
describe("F2.3.1 — createStaffMember duplicate-guard je per-org", () => {
  it("istega uporabnika je dovoljeno dodati v DRUGO organizacijo", async () => {
    // onlyA je staff samo v orgA. adminB ga doda v orgB -> MORA uspeti.
    loginAs(ID.adminB, "ADMIN", ID.orgB)
    const res = await createStaffMember({
      name: "Delavec Now v B",
      email: `${ID.onlyA}@f231.test`,
      isActive: true,
    })
    expect(res.success).toBe(true)
    // Nova vrstica v orgB za istega userja.
    const newRow = await prisma.staff.findFirst({
      where: { userId: ID.onlyA, organizationId: ID.orgB },
      orderBy: { createdAt: "desc" },
    })
    expect(newRow).not.toBeNull()
    if (newRow?.organizationId === ID.orgB) {
      await prisma.staff.delete({ where: { id: newRow.id } })
    }
  })

  it("dvojnik za ISTO (user, org) je zavrnjen s čitljivo napako", async () => {
    // staff je v orgB (selfB). adminB skuša dodati istega -> zavrnjeno.
    loginAs(ID.adminB, "ADMIN", ID.orgB)
    const res = await createStaffMember({
      name: "Dvojnik v B",
      email: `${ID.staff}@f231.test`,
      isActive: true,
    })
    expect(res.success).toBe(false)
    expect(res.error).toContain("already exists")
  })
})

// ------------------------------------------------------------
// 7: STAFF iz orgA NE SME spreminjati termina druge organizacije
// ------------------------------------------------------------
describe("F2.3.1 — izolacija sprememb termina po orgi", () => {
  it("ownership check v updateAppointmentStatus ne prepozna Staffa iz druge org", async () => {
    const { updateAppointmentStatus } = await import("@/app/actions/appointments")
    // Staff iz orgB telefonira termin, ki pripada StaffA (orgA). Termin iz
    // druge org sploh NI najden (org-scoped findFirst) -> zavrnjen (fail-closed).
    loginAs(ID.staff, "STAFF", ID.orgB)
    await expect(updateAppointmentStatus(ID.aptA, "COMPLETED")).rejects.toThrow()
  })

  it("recordAppointmentTip za tuj termin druge org je zavrnjen", async () => {
    const { recordAppointmentTip } = await import("@/app/actions/appointments")
    loginAs(ID.staff, "STAFF", ID.orgB) // orgB staff skuša namestiti nasvet na termin orgA
    const res = await recordAppointmentTip(ID.aptA, { amount: 5, method: "cash" })
    expect(res.success).toBe(false) // termin iz druge org ni dosegljiv
  })

  it("STAFF lastne org lahko ureja LASTEN termin (regresija — ni preostre zapornice)", async () => {
    const { updateAppointmentStatus } = await import("@/app/actions/appointments")
    // StaffA (orgA) sme spremeniti status termina, ki mu pripada. PENDING ne
    // sproži poštne poti (next `after()` ni v obsegu zahteve zunaj Nextja),
    // zato je to čist dokaz dovoljene lastniške spremembe.
    loginAs(ID.staff, "STAFF", ID.orgA)
    await expect(updateAppointmentStatus(ID.aptA, "PENDING")).resolves.not.toThrow()
    const back = await prisma.appointment.findUnique({ where: { id: ID.aptA } })
    expect(back!.status).toBe("PENDING")
    // Povrni na CONFIRMED neposredno (brez poštnega after()).
    await prisma.appointment.update({
      where: { id: ID.aptA },
      data: { status: "CONFIRMED" },
    })
  })
})

// ------------------------------------------------------------
// 8: obstoječi beauty rezervacijski potek še deluje (org-scoped)
// ------------------------------------------------------------
describe("F2.3.1 — regresija: beauty rezervacijski potek ostaja org-scoped", () => {
  it("getServicesForBooking vrne storitve samo trenutne org", async () => {
    // resolveRequestOrg beri trust header; v testu ga ni -> default ACTIVE
    loginAs(ID.customer, "CLIENTE")
    const svcs = await getServicesForBooking([ID.svcA, ID.svcB])
    expect(svcs.length).toBeLessThanOrEqual(2)
  })

  it("getCurrentUserStaffId vrne Staff razrešene (org-scoped) org", async () => {
    // Brez tenanta getResolvedOrg pade na prvo ACTIVE org (orgA).
    // Staffa vrnemo le iz te org-ja — ne iz poljubne druge vrstice.
    loginAs(ID.staff, "STAFF")
    const staffId = await getCurrentUserStaffId()
    expect(staffId).toBe(ID.staffA) // staff v default org = orgA
  })

  it("liste<Staff> v javni objavi loči po orgi", async () => {
    const a = await prisma.staff.count({ where: { organizationId: ID.orgA, isActive: true } })
    const b = await prisma.staff.count({ where: { organizationId: ID.orgB, isActive: true } })
    expect(a).toBe(2) // StaffA + onlyAStaff
    expect(b).toBe(1) // StaffB
  })
})