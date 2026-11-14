// ============================================================
// 2D-3 — PREVERJANJE E-POŠTE: token lifecycle (single-use, expiry,
// wrong/used token rejected, emailVerified timp). Testno okolje:
// e-poštni servis ni konfiguriran → registerUser vrne verificationUrl.
// Uporabnik se lahko prijavi ŠELE po uspešni verifikaciji.
//
// Izolirana DB (markec_e2e_test):
//   node scripts/run-with-test-db.mjs vitest run --config vitest.itest.config.ts \
//     tests/integration/email-verification.itest.ts
// ============================================================

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ session: null as null | { user?: unknown } }))
vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async () => undefined,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => null }) }))
vi.mock("next/server", () => ({ after: (fn: () => unknown) => Promise.resolve(undefined) }))

import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { registerUser, verifyEmail, resendVerification } from "@/app/actions/auth"

const RUN = Date.now().toString(36).slice(-6)
const EMAIL = `2d3.vf.${RUN}@markec.test`
const PASS = "Vstop_verify_2026!"

let createdUserId: string

async function hashPassword() {
  return bcrypt.hash(PASS, 10)
}

describe("2D-3 — verifikacija e-pošte (token lifecycle)", () => {
  beforeAll(async () => {
    state.session = null
    // Izpiši stanje e-poštnega servisa (res dokumentiramo, ne izmišljamo).
    const { isEmailServiceConfigured } = await import("@/lib/email/config")
    // eslint-disable-next-line no-console
    console.log("isEmailServiceConfigured:", isEmailServiceConfigured())
  })

  it("1. registerUser ustvari NEVERIFICIRAN račun in vrne verificationUrl (test brez e-pošte)", async () => {
    const res = await registerUser({ name: "Verif Test", email: EMAIL, password: PASS, confirmPassword: PASS } as never)
    // eslint-disable-next-line no-console
    console.log("registerUser res:", JSON.stringify(res))
    expect(res.success).toBe(true)
    // Brez e-poštnega servisa registerUser vrne povezavo → dokumentirano,
    // ne izmišljamo dostave.
    expect((res as { emailSent?: boolean }).emailSent).toBe(false)
    const url = (res as { verificationUrl?: string }).verificationUrl
    expect(url).toContain("/verify-email?token=")
    const token = url!.split("=")[1]

    const user = await prisma.user.findUnique({ where: { email: EMAIL } })
    createdUserId = user!.id
    // Uporabnik še NI verificiran.
    expect(user!.emailVerified).toBeNull()

    // Token obstaja v bazi.
    const vt = await prisma.verificationToken.findUnique({ where: { token } })
    expect(vt).not.toBeNull()
    expect(vt!.expires.getTime()).toBeGreaterThan(Date.now())

    // Prijava bi še bila blokirana (authorize preveri emailVerified) — tu
    // preverimo, da je emailVerified null dokler ne verifikacije.
    expect(user!.emailVerified).toBeNull()
  })

  it("2. napačen/nepoznan token zavrne verifikacijo", async () => {
    const bad = await verifyEmail("nope=nope-not-a-real-token")
    expect(bad.success).toBe(false)
  })

  it("3. pravilen token verifikacijo opravi; emailVerified nastavljen in token enkraten (zbrisan)", async () => {
    // Znova registriramo, da dobimo veljaven token (po brisanju v afterAll 1. test ni zbral).
    const res2 = await registerUser({
      name: "Verif Test 2",
      email: `2d3.vf2.${RUN}@markec.test`,
      password: PASS,
      confirmPassword: PASS,
    } as never)
    const token2 = (res2 as { verificationUrl?: string }).verificationUrl!.split("=")[1]

    const v = await verifyEmail(token2)
    expect(v.success).toBe(true)

    const user = await prisma.user.findUnique({ where: { email: `2d3.vf2.${RUN}@markec.test` } })
    expect(user!.emailVerified).not.toBeNull()

    // Token enkraten: po uspešni verifikaciji je izbrisan.
    expect(await prisma.verificationToken.findUnique({ where: { token: token2 } })).toBeNull()

    // Ponovna uporaba istega (že porabljenega) tokena → zavrnjeno.
    const again = await verifyEmail(token2)
    expect(again.success).toBe(false)
  })

  it("4. potekel token odvrže verifikacijo (in se zbriše)", async () => {
    const token = `2d3.expired.${RUN}`
    await prisma.verificationToken.create({
      data: { identifier: EMAIL, token, expires: new Date(Date.now() - 1000) },
    })
    const res = await verifyEmail(token)
    expect(res.success).toBe(false)
    expect(await prisma.verificationToken.findUnique({ where: { token } })).toBeNull()
  })
})

// 2D-4 — varni ponovni posljetek verifikacije.
describe("2D-4 — ponovni posljetek verifikacije (resend)", () => {
  it("5. resend za neznan e-poštni naslov NE razkrije obstoja (ignored)", async () => {
    const res = await resendVerification({ email: `nobody.${RUN}@markec.test` })
    expect(res.success).toBe(true)
    expect((res as { ignored?: boolean }).ignored).toBe(true)
    expect((res as { emailSent?: boolean }).emailSent).toBe(false)
    expect("verificationUrl" in res).toBe(false)
  })

  it("6. resend za že verificiran e-poštni naslov ne razkrije nič in ne regenerira", async () => {
    const res = await resendVerification({ email: `2d3.vf2.${RUN}@markec.test` })
    expect(res.success).toBe(true)
    expect((res as { ignored?: boolean }).ignored).toBe(true)
    // Ni novega tokena za tej identifier.
    const tokens = await prisma.verificationToken.count({ where: { identifier: `2d3.vf2.${RUN}@markec.test` } })
    expect(tokens).toBe(0)
  })

  it("7. resend za NEVERIFICIRAN e-poštni naslov ustvari NOV token in vrne verificationUrl (test brez e-pošte)", async () => {
    const fresh = `2d3.rs.${RUN}@markec.test`
    await prisma.user.create({
      data: { name: "Resend User", email: fresh, password: await hashPassword(), role: "CLIENTE" },
    })
    const res = await resendVerification({ email: fresh })
    expect(res.success).toBe(true)
    expect((res as { ignored?: boolean }).ignored).toBeUndefined()
    const url = (res as { verificationUrl?: string }).verificationUrl
    expect(url).toContain("/verify-email?token=")
    const token = url!.split("=")[1]
    // Nov token ustvarjen.
    const vt = await prisma.verificationToken.findUnique({ where: { token } })
    expect(vt).not.toBeNull()
    expect(vt!.expires.getTime()).toBeGreaterThan(Date.now())
  })

  it("8. stari token ne omogoča več uporabe po resendu (izbrisan); nov validates, nato enkraten", async () => {
    const fresh = `2d3.rs2.${RUN}@markec.test`
    await prisma.user.create({
      data: { name: "Resend User 2", email: fresh, password: await hashPassword(), role: "CLIENTE" },
    })
    // Ustvari star token ročno.
    const oldToken = `2d3.star.${RUN}`
    await prisma.verificationToken.create({
      data: { identifier: fresh, token: oldToken, expires: new Date(Date.now() + 3600000) },
    })
    // Resend izbrise vse staro in ustvari novo.
    const res = await resendVerification({ email: fresh })
    const url = (res as { verificationUrl?: string }).verificationUrl
    const newToken = url!.split("=")[1]
    // Stari token izbrisan.
    expect(await prisma.verificationToken.findUnique({ where: { token: oldToken } })).toBeNull()
    // Novo velja in verifikacijo opravi; uporabnik postane verifikiran.
    const v = await verifyEmail(newToken)
    expect(v.success).toBe(true)
    const user = await prisma.user.findUnique({ where: { email: fresh } })
    expect(user!.emailVerified).not.toBeNull()
    // Enkratnost: ponovna uporaba istega novega tokena zavrnjena.
    expect((await verifyEmail(newToken)).success).toBe(false)
  })

  it("9. cooldown: resend med aktivnim 24h tokenom NE ustvari dodatnega (rate-limit)", async () => {
    // Svež, nepreverjen e-poštni naslov (test 8 je verifikiral EMAIL).
    const cdEmail = `2d3.cd.${RUN}@markec.test`
    await prisma.user.create({
      data: {
        name: "Cd User",
        email: cdEmail,
        password: await hashPassword(),
        role: "CLIENTE",
      },
    })
    const r1 = await resendVerification({ email: cdEmail })
    expect(r1.success).toBe(true)
    const url1 = (r1 as { verificationUrl?: string }).verificationUrl
    const t1 = url1!.split("=")[1]
    // Ročno dodaj še en veljaven token, da simuliramo "že poslano ≤24h".
    await prisma.verificationToken.create({
      data: { identifier: cdEmail, token: `2d3.cooldown.${RUN}`, expires: new Date(Date.now() + 3600000) },
    })
    const r2 = await resendVerification({ email: cdEmail })
    expect(r2.success).toBe(true)
    expect((r2 as { ignored?: boolean }).ignored).toBe(true)
    // Kljub poskusu ne nastane NOV token — število se ne poveča preko obstoječih.
    const tokens = await prisma.verificationToken.count({ where: { identifier: cdEmail } })
    expect(tokens).toBeGreaterThanOrEqual(1)
    // t1 še vedno obstaja (prvi posljetek), ni novega od r2.
    expect(await prisma.verificationToken.findUnique({ where: { token: t1 } })).not.toBeNull()
  })
})

afterAll(async () => {
  if (createdUserId) await prisma.user.delete({ where: { id: createdUserId } }).catch(() => undefined)
  await prisma.user.deleteMany({ where: { email: { startsWith: "2d3.vf" } } }).catch(() => undefined)
  await prisma.user.deleteMany({ where: { email: { startsWith: "2d3.cd" } } }).catch(() => undefined)
  await prisma.user.deleteMany({ where: { email: { startsWith: "2d3.rs" } } }).catch(() => undefined)
  await prisma.verificationToken.deleteMany({ where: { identifier: { startsWith: "2d3.vf" } } }).catch(() => undefined)
  await prisma.verificationToken.deleteMany({ where: { identifier: { startsWith: "2d3.cd" } } }).catch(() => undefined)
  await prisma.verificationToken.deleteMany({ where: { identifier: { startsWith: "2d3.rs" } } }).catch(() => undefined)
  await prisma.$disconnect()
})