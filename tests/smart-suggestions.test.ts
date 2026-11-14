import { describe, expect, it } from "vitest"
import { buildSmartSuggestions, type SmartSuggestionInput } from "@/lib/profiles/smart-suggestions"

function input(over: Partial<SmartSuggestionInput> = {}): SmartSuggestionInput {
  return {
    counts: { apiary: 0, hive: 0, colony: 0, inspection: 0, harvest: 0, products: 0, orders: 0 },
    published: false,
    beekeeping: true,
    shopCapable: true,
    ...over,
  }
}

describe("buildSmartSuggestions — tire-service chain (2D-1S)", () => {
  it("empty workshop → suggest vehicle first", () => {
    const s = buildSmartSuggestions(input({ beekeeping: false, tireService: true, counts: { apiary: 0, hive: 0, colony: 0, inspection: 0, harvest: 0, products: 0, orders: 0, vehicles: 0, tireSets: 0, workOrders: 0, partOrders: 0 } }))
    expect(s[0].key).toBe("ws.vehicle")
  })

  it("vehicle present, no tire set → suggest tire set", () => {
    const s = buildSmartSuggestions(input({ beekeeping: false, tireService: true, counts: { apiary: 0, hive: 0, colony: 0, inspection: 0, harvest: 0, products: 0, orders: 0, vehicles: 1, tireSets: 0, workOrders: 0, partOrders: 0 } }))
    expect(s[0].key).toBe("ws.tireSet")
  })

  it("vehicle+tire set, no work order → suggest work order", () => {
    const s = buildSmartSuggestions(input({ beekeeping: false, tireService: true, counts: { apiary: 0, hive: 0, colony: 0, inspection: 0, harvest: 0, products: 0, orders: 0, vehicles: 1, tireSets: 1, workOrders: 0, partOrders: 0 } }))
    expect(s[0].key).toBe("ws.workOrder")
  })

  it("work order present, no part consumption → suggest parts", () => {
    const s = buildSmartSuggestions(input({ beekeeping: false, tireService: true, counts: { apiary: 0, hive: 0, colony: 0, inspection: 0, harvest: 0, products: 0, orders: 0, vehicles: 1, tireSets: 1, workOrders: 1, partOrders: 0 } }))
    expect(s[0].key).toBe("ws.parts")
  })

  it("full workshop chain → only publish", () => {
    const s = buildSmartSuggestions(input({ beekeeping: false, tireService: true, counts: { apiary: 0, hive: 0, colony: 0, inspection: 0, harvest: 0, products: 0, orders: 0, vehicles: 1, tireSets: 1, workOrders: 1, partOrders: 1 } }))
    expect(s.some((x) => x.key.startsWith("ws."))).toBe(false)
    expect(s.some((x) => x.key === "publish")).toBe(true)
  })

  it("beehive unaffected when tireService flag set but beekeeping still true", () => {
    const s = buildSmartSuggestions(input({ beekeeping: true, tireService: true, counts: { apiary: 0, hive: 0, colony: 0, inspection: 0, harvest: 0, products: 0, orders: 0, vehicles: 1, tireSets: 1, workOrders: 1, partOrders: 1 } }))
    expect(s[0].key).toBe("bee.apiary")
  })
})

describe("buildSmartSuggestions — beekeeping chain (2D-1M)", () => {
  it("empty beekeeper → suggest apiary first", () => {
    const s = buildSmartSuggestions(input())
    expect(s[0].key).toBe("bee.apiary")
    expect(s.length).toBeLessThanOrEqual(4)
  })

  it("apiary present, no hive → suggest hive (chain advances)", () => {
    const s = buildSmartSuggestions(input({ counts: { apiary: 1, hive: 0, colony: 0, inspection: 0, harvest: 0, products: 0, orders: 0 } }))
    expect(s[0].key).toBe("bee.hive")
    expect(s.some((x) => x.key === "bee.apiary")).toBe(false)
  })

  it("hive present, no colony → suggest colony", () => {
    const s = buildSmartSuggestions(input({ counts: { apiary: 1, hive: 1, colony: 0, inspection: 0, harvest: 0, products: 0, orders: 0 } }))
    expect(s[0].key).toBe("bee.colony")
  })

  it("colony present, no inspection → suggest inspection", () => {
    const s = buildSmartSuggestions(input({ counts: { apiary: 1, hive: 1, colony: 1, inspection: 0, harvest: 0, products: 0, orders: 0 } }))
    expect(s[0].key).toBe("bee.inspection")
  })

  it("inspection present, no harvest → suggest harvest", () => {
    const s = buildSmartSuggestions(input({ counts: { apiary: 1, hive: 1, colony: 1, inspection: 1, harvest: 0, products: 0, orders: 0 } }))
    expect(s[0].key).toBe("bee.harvest")
  })

  it("full chain → no more chain suggestions, only publish", () => {
    const s = buildSmartSuggestions(input({ counts: { apiary: 1, hive: 1, colony: 1, inspection: 1, harvest: 1, products: 0, orders: 0 } }))
    expect(s.some((x) => x.key.startsWith("bee."))).toBe(false)
    expect(s.some((x) => x.key === "publish")).toBe(true)
  })
})

describe("buildSmartSuggestions — generic (other activities)", () => {
  it("non-beekeeper unpublished shop → publish + first product + first order", () => {
    const s = buildSmartSuggestions(input({ beekeeping: false, published: false }))
    expect(s[0].key).toBe("publish")
    const keys = s.map((x) => x.key)
    expect(keys).toContain("firstProduct")
    expect(keys).toContain("firstOrder")
  })

  it("non-beekeeper published with products → no publish/firstProduct; order suggestion may remain", () => {
    const s = buildSmartSuggestions(input({ beekeeping: false, published: true, counts: { apiary: 0, hive: 0, colony: 0, inspection: 0, harvest: 0, products: 2, orders: 0 } }))
    expect(s.some((x) => x.key === "publish")).toBe(false)
    expect(s.some((x) => x.key === "firstProduct")).toBe(false)
  })

  it("no suggestion after full shop is done (products + orders + published)", () => {
    const s = buildSmartSuggestions(input({ beekeeping: false, published: true, counts: { apiary: 0, hive: 0, colony: 0, inspection: 0, harvest: 0, products: 2, orders: 1 } }))
    expect(s.length).toBe(0)
  })
})

describe("buildSmartSuggestions — limits", () => {
  it("respects limit=2", () => {
    const s = buildSmartSuggestions(input({ limit: 2 }))
    expect(s.length).toBeLessThanOrEqual(2)
  })
})