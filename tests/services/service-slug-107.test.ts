// ============================================================
// P1 #107 — testi za dva pomožnika, uvedena ob popravkih:
//   1) slug storitve (`slugifyService`, `uniqueServiceSlug`)
//   2) človeška številka naročila (`shortOrderNumber`)
//
// Oba sta čista (brez DB): unikatnost preverjamo z lažno `isTaken`
// funkcijo, kar je tudi namen — logika naj bo testirljiva brez Prisme.
// ============================================================

import { describe, it, expect } from "vitest"
import { slugifyService, uniqueServiceSlug } from "@/lib/services/slug"
import { shortOrderNumber } from "@/lib/orders/number"

describe("slugifyService — oblika javnega naslova storitve", () => {
  it("šumniki se prevedejo, presledki postanejo pomišljaji", () => {
    expect(slugifyService("Barvanje korenin")).toBe("barvanje-korenin")
    expect(slugifyService("Striženje in oblikovanje")).toBe(
      "strizenje-in-oblikovanje"
    )
    expect(slugifyService("Špricanje s čopičem")).toBe("spricanje-s-copicem")
  })

  it("ločila in podvojeni presledki se strnejo (brez vodilnih/zaporednih -)", () => {
    expect(slugifyService("  Gel  —  manikira!! ")).toBe("gel-manikira")
    expect(slugifyService("-/-")).toBe("")
    expect(slugifyService("")).toBe("")
  })

  it("dolžina je omejena in se ne konča s pomišljajem", () => {
    const long = slugifyService("a".repeat(80), 10)
    expect(long.length).toBe(10)
    expect(long.endsWith("-")).toBe(false)
    const cut = slugifyService("beseda ".repeat(20), 12)
    expect(cut.endsWith("-")).toBe(false)
  })

  it("ne pušča velikih črk (enako ime → enak slug)", () => {
    expect(slugifyService("BARVANJE")).toBe(slugifyService("barvanje"))
  })
})

describe("uniqueServiceSlug — unikatnost znotraj salona", () => {
  it("prost slug vrne nespremenjen", async () => {
    const slug = await uniqueServiceSlug("barvanje-korenin", async () => false)
    expect(slug).toBe("barvanje-korenin")
  })

  it("zaseden slug dobi zaporedno končnico -2", async () => {
    const taken = new Set(["barvanje-korenin"])
    const slug = await uniqueServiceSlug("barvanje-korenin", async (s) =>
      taken.has(s)
    )
    expect(slug).toBe("barvanje-korenin-2")
  })

  it("več zasedenih variant → prva prosta (-4)", async () => {
    const taken = new Set([
      "masaza",
      "masaza-2",
      "masaza-3",
    ])
    const slug = await uniqueServiceSlug("Masaža", async (s) => taken.has(s))
    expect(slug).toBe("masaza-4")
  })

  it("prazen vnos uporabi rezervno ime (nikoli prazen slug)", async () => {
    expect(await uniqueServiceSlug("", async () => false)).toBe("storitev")
    expect(
      await uniqueServiceSlug("", async () => false, "nega-rok")
    ).toBe("nega-rok")
  })

  it("nikoli ne vrne podvojenega sluga, tudi če je zasedenih vseh 50 variant", async () => {
    const base = "storitev"
    const taken = new Set<string>([base])
    for (let i = 2; i <= 50; i++) taken.add(`${base}-${i}`)
    const slug = await uniqueServiceSlug(base, async (s) => taken.has(s))
    expect(taken.has(slug)).toBe(false)
    expect(slug.startsWith(base)).toBe(true)
  })
})

describe("shortOrderNumber — človeška številka naročila", () => {
  it("vzame zadnjih 8 znakov ID-ja z velikimi črkami", () => {
    expect(shortOrderNumber("cmwkwohy8000ewg0gdedi7ddk")).toBe("DEDI7DDK")
  })

  it("daljši/shorter ID se obdela varno (brez izjeme)", () => {
    expect(shortOrderNumber("abc")).toBe("ABC")
    expect(shortOrderNumber("")).toBe("")
  })

  it("različni naročili imata različno številko (isti predponi salona)", () => {
    const a = shortOrderNumber("cmwkwohy8000ewg0gdedi7ddk")
    const b = shortOrderNumber("cmwkwohy8000ewg0gxxxxxxxx")
    expect(a).not.toBe(b)
  })
})
