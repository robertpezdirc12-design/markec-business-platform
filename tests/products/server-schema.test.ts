// ============================================================
// P1-A + P1 #107 — bela lista `Product.stockQuantity` na strežniku.
//
// ZGODOVINA PRAVILA:
//  - P1-A (prvotno): `stockQuantity` je bila UMAKNJENA iz strežniške sheme,
//    ker je obrazec ni pošiljal in je vsak surov vnos pomenil obhod knjige
//    gibanj (mass assignment → zaloga brez sledi).
//  - P1 #107 (to dopolnilo): obrazec ZDAJ pošilja ZAČETNO zalogo ob
//    ustvarjanju izdelka, zato je polje dovoljeno NATANKO pri CREATE
//    (celo število, 0..1.000.000). Vsak tak vnos dobi še `StockMovement`
//    (IN/MANUAL) v `createProduct` — zaloga torej ni več "neevidentirana".
//  - Pri UPDATE polje ostaja PREPOVEDANO (`productServerUpdateSchema` ga
//    izloči z `.omit()`): edina pot do spremembe zaloge je knjiga gibanj
//    (Prejem blaga / prodaja / Inventura). Brez tega bi lahko urejanje
//    izdelka tiho prepisalo zalogo, knjiga gibanj pa bi lagala.
//
// Test je čist (brez DB): preverja le Zod validacijo.
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

describe("P1 #107 — productServerSchema DOVOLI začetno zalogo (create)", () => {
  it("vhod s stockQuantity:100 → rezultat VSEBUJE stockQuantity (A1)", () => {
    const parsed = parseProductServerInput(
      { ...baseProduct, stockQuantity: 100 },
      "create"
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.stockQuantity).toBe(100)
      // običajna polja so ohranjena
      expect(parsed.data.name).toBe(baseProduct.name)
      expect(parsed.data.price).toBe(baseProduct.price)
    }
  })

  it("vhod s stockQuantity:0 → rezultat vsebuje 0 (A2)", () => {
    const parsed = parseProductServerInput(
      { ...baseProduct, stockQuantity: 0 },
      "create"
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.stockQuantity).toBe(0)
    }
  })

  it("vhod brez stockQuantity → veljavna običajna validacija (A3)", () => {
    const parsed = parseProductServerInput({ ...baseProduct }, "create")
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.name).toBe(baseProduct.name)
      expect(parsed.data.price).toBe(baseProduct.price)
      expect(parsed.data.trackInventory).toBe(true)
      expect(parsed.data.stockQuantity).toBeUndefined()
    }
  })

  it("dodatna polja ne izginejo, zaloga ostane (A4)", () => {
    const parsed = parseProductServerInput(
      { ...baseProduct, description: "opis", stockQuantity: 42 },
      "create"
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.description).toBe("opis")
      expect(parsed.data.stockQuantity).toBe(42)
    }
  })

  it("negativna zaloga je zavrnjena", () => {
    const parsed = parseProductServerInput(
      { ...baseProduct, stockQuantity: -1 },
      "create"
    )
    expect(parsed.ok).toBe(false)
  })

  it("decimalna zaloga je zavrnjena (zaloga je celo število)", () => {
    const parsed = parseProductServerInput(
      { ...baseProduct, stockQuantity: 2.5 },
      "create"
    )
    expect(parsed.ok).toBe(false)
  })

  it("nesmiselno velika zaloga je zavrnjena (varovalka pred tipkarsko napako)", () => {
    const parsed = parseProductServerInput(
      { ...baseProduct, stockQuantity: 1_000_001 },
      "create"
    )
    expect(parsed.ok).toBe(false)
  })
})

describe("P1-A — productServerUpdateSchema še vedno BREZ stockQuantity (update)", () => {
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

describe("P1-A/P1 #107 — meja med shemama (whitelist)", () => {
  it("productServerSchema (create) IMA ključ stockQuantity", () => {
    const keys = Object.keys(productServerSchema.shape)
    expect(keys).toContain("stockQuantity")
  })
  it("productServerUpdateSchema NIMA ključa stockQuantity", () => {
    const keys = Object.keys(productServerUpdateSchema.shape)
    expect(keys).not.toContain("stockQuantity")
  })
  it("update parse zavrže stockQuantity tudi, če pride v surovem vnosu", () => {
    const raw = productServerUpdateSchema.parse({
      name: "Ime",
      stockQuantity: 100,
    })
    expect("stockQuantity" in raw).toBe(false)
  })
})
