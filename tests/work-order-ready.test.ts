import { describe, it, expect } from "vitest"
import {
  isReadyStage,
  shouldNotifyReady,
  readyEmailContent,
} from "@/lib/work-orders/ready-notification"

describe("pripravljeno za prevzem — odločitev", () => {
  it("prepozna stopnjo predaje po ključu in po imenu", () => {
    expect(isReadyStage({ key: "delivery", name: "Predaja" })).toBe(true)
    expect(isReadyStage({ key: "s8", name: "Pripravljeno za prevzem" })).toBe(true)
    expect(isReadyStage({ key: "pickup", name: null })).toBe(true)
    expect(isReadyStage({ key: "sewing", name: "Šivanje" })).toBe(false)
    expect(isReadyStage({ key: null, name: null })).toBe(false)
  })

  it("obvesti samo ob prehodu V pripravljeno stopnjo", () => {
    expect(
      shouldNotifyReady({
        fromStageKey: "sewing",
        toStageKey: "delivery",
        toStageName: "Predaja",
      })
    ).toBe(true)
  })

  it("ne obvesti, če ostanemo v isti stopnji", () => {
    expect(
      shouldNotifyReady({
        fromStageKey: "delivery",
        toStageKey: "delivery",
        toStageName: "Predaja",
      })
    ).toBe(false)
  })

  it("ne obvesti za vmesne stopnje", () => {
    expect(
      shouldNotifyReady({
        fromStageKey: "cutting",
        toStageKey: "sewing",
        toStageName: "Šivanje",
      })
    ).toBe(false)
  })
})

describe("pripravljeno za prevzem — vsebina sporočila", () => {
  const base = {
    businessName: "Atelje Test",
    customerName: "Maja",
    orderNumber: 7,
    orderTitle: "Suknja",
    dueDateLabel: "20. december 2026",
    totalLabel: "45,50 €",
    publicUrl: "https://example.com/s/atelje/order/token",
  }

  it("vsebuje referenco, rok, znesek in povezavo", () => {
    const { subject, lines } = readyEmailContent(base)
    const text = lines.join("\n")
    expect(subject).toContain("#007")
    expect(text).toContain("Pozdravljeni, Maja!")
    expect(text).toContain("Suknja")
    expect(text).toContain("Rok: 20. december 2026")
    expect(text).toContain("Znesek: 45,50 €")
    expect(text).toContain(base.publicUrl)
    expect(text).toContain("Atelje Test")
  })

  it("ne izmisli podatkov, ki jih ni", () => {
    const { lines } = readyEmailContent({
      ...base,
      customerName: null,
      dueDateLabel: null,
      totalLabel: null,
      publicUrl: null,
    })
    const text = lines.join("\n")
    expect(text.startsWith("Pozdravljeni!")).toBe(true)
    expect(text).not.toContain("Rok:")
    expect(text).not.toContain("Znesek:")
    expect(text).not.toContain("Podrobnosti")
  })

  it("referenca je tri-mestna tudi pri majhnih številkah", () => {
    expect(readyEmailContent({ ...base, orderNumber: 1 }).subject).toContain("#001")
    expect(readyEmailContent({ ...base, orderNumber: 1234 }).subject).toContain("#1234")
  })
})
