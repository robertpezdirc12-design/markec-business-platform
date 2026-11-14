// ============================================================
// P1-A — strežniška blokada neposrednega zapisa Product.stockQuantity.
// Pure unit test (brez DB): parseProductServerInput je čista Zod
// validacija; stockQuantity je bila odstranjena iz productServerSchema
// → safeParse NE vrne tega ključa (Zod default strip unknown).
// Testira se samo strežniško validacijsko funkcijo, ne baze.
// ============================================================

import { describe, it, expect } from "vitest"
import {
  parseProductServerInput,
  productServerSchema,
  productServerUpdateSchema,
} from "@/lib/products/server-schema"

const baseProduct = {
  name: "Cvetlični med 500 g",
  price: 12,
  trackInventory: true,
}

describe("P1-A — productServerSchema brez stockQuantity (create)", () => {
  it("vhod s stockQuantity:100 → rezultat NIMA stockQuantity (A1)", () => {
    const parsed = parseProductServerInput(
      { ...baseProduct, stockQuantity: 100 },
      "create"
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      // Zod po privzetem strip-mi unknown → stockQuantity ne sme biti prisoten
      expect("stockQuantity" in parsed.data).toBe(false)
      expect((parsed.data as Record<string, unknown>).stockQuantity).toBeUndefined()
      // običajna polja so ohranjena
      expect(parsed.data.name).toBe(baseProduct.name)
      expect(parsed.data.price).toBe(baseProduct.price)
    }
  })

  it("vhod s stockQuantity:0 → rezultat NIMA stockQuantity (A2)", () => {
    const parsed = parseProductServerInput(
      { ...baseProduct, stockQuantity: 0 },
      "create"
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect("stockQuantity" in parsed.data).toBe(false)
      expect((parsed.data as Record<string, unknown>).stockQuantity).toBeUndefined()
    }
  })

  it("vhod brez stockQuantity → veljavna običajna validacija (A3)", () => {
    const parsed = parseProductServerInput({ ...baseProduct }, "create")
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.name).toBe(baseProduct.name)
      expect(parsed.data.price).toBe(baseProduct.price)
      expect(parsed.data.trackInventory).toBe(true)
    }
  })

  it("dodatno stockQuantity ne vpliva in ni v rezultatu (A4)", () => {
    const parsed = parseProductServerInput(
      { ...baseProduct, description: "opis", stockQuantity: 42 },
      "create"
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      // običajna polja ohranjena
      expect(parsed.data.description).toBe("opis")
      // stockQuantity ni v validiranih podatkih
      expect("stockQuantity" in parsed.data).toBe(false)
    }
  })
})

describe("P1-A — productServerUpdateSchema brez stockQuantity (update)", () => {
  it("update z stockQuantity → NE sme vsebovati stockQuantity", () => {
    const parsed = parseProductServerInput(
      { name: "Novo ime", stockQuantity: 99 },
      "update"
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.name).toBe("Novo ime")
      expect("stockQuantity" in parsed.data).toBe(false)
    }
  })

  it("update samo cene → običajna sprememba, brez vpliva na zalogo", () => {
    const parsed = parseProductServerInput({ price: 15 }, "update")
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.price).toBe(15)
      expect("stockQuantity" in parsed.data).toBe(false)
    }
  })
})

describe("P1-A — whitelist določilo (shemi ne dopuščata stockQuantity)", () => {
  it("productServerSchema nima ključa stockQuantity", () => {
    const keys = Object.keys(productServerSchema.shape)
    expect(keys).not.toContain("stockQuantity")
  })
  it("productServerUpdateSchema nima ključa stockQuantity", () => {
    const keys = Object.keys(productServerUpdateSchema.shape)
    expect(keys).not.toContain("stockQuantity")
  })
  it("neznani ključ stockQuantity:100 je iz vrstnega rezultata izgubljen", () => {
    const raw = productServerSchema.parse({
      ...baseProduct,
      stockQuantity: 100,
    })
    expect("stockQuantity" in raw).toBe(false)
  })
})