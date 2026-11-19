import { describe, it, expect, vi, beforeEach } from "vitest"

// ============================================================
// USERNAME LOGIN — čista logika v login-resolution.ts
//
// Prijava sprejme e-pošto ALI uporabniško ime (polje `login`).
// resolveLoginToEmail razreži vnos na e-pošto; normalizeUsername
// normalizira username v kanonično (lowercase) obliko za shrambo.
// ============================================================

const findUniqueMock = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: findUniqueMock,
    },
  },
}))

const {
  resolveLoginToEmail,
  normalizeUsername,
} = await import("../src/lib/auth/login-resolution")

beforeEach(() => {
  findUniqueMock.mockReset()
})

describe("resolveLoginToEmail", () => {
  it("vrne e-pošto neposredno, ko login vsebuje @ (male črke)", async () => {
    findUniqueMock.mockResolvedValue(null)
    const email = await resolveLoginToEmail("Janez@Primer.si")
    expect(email).toBe("janez@primer.si")
    // Ni iskanja po username-u — gre za e-pošto.
    expect(findUniqueMock).not.toHaveBeenCalled()
  })

  it("poišče uporabnika po username (lowercase odsotno občutljivo)", async () => {
    findUniqueMock.mockResolvedValue({ email: "janez@primer.si" })
    const email = await resolveLoginToEmail("Janez_123")
    expect(email).toBe("janez@primer.si")
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { username: "janez_123" },
    })
  })

  it("vrne prazen string za neznan username", async () => {
    findUniqueMock.mockResolvedValue(null)
    expect(await resolveLoginToEmail("neobstajajoc")).toBe("")
  })

  it("vrne prazen string za prazen vnos (ne kliče baze)", async () => {
    expect(await resolveLoginToEmail("")).toBe("")
    expect(findUniqueMock).not.toHaveBeenCalled()
  })
})

describe("normalizeUsername", () => {
  it("lowercase + trim in vrne uporabniško ime", () => {
    expect(normalizeUsername("  Janez_123 ")).toBe("janez_123")
  })
  it("vrne null za prazno ali ničla", () => {
    expect(normalizeUsername("")).toBeNull()
    expect(normalizeUsername("   ")).toBeNull()
    expect(normalizeUsername(null)).toBeNull()
    expect(normalizeUsername(undefined)).toBeNull()
  })
})