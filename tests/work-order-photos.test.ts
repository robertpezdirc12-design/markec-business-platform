import { describe, it, expect } from "vitest"
import {
  isAllowedPhotoUrl,
  sanitizeCaption,
  canAddPhoto,
  groupPhotosByStage,
  MAX_PHOTOS_PER_ORDER,
  MAX_PHOTO_CAPTION,
} from "@/lib/work-orders/photo-rules"

describe("fotografije naročila — URL", () => {
  it("dovoli https in naše poti", () => {
    expect(isAllowedPhotoUrl("https://res.cloudinary.com/demo/x.jpg")).toBe(true)
    expect(isAllowedPhotoUrl("/api/media/abc")).toBe(true)
  })

  it("zavrne javascript:, data: in smeti", () => {
    expect(isAllowedPhotoUrl("javascript:alert(1)")).toBe(false)
    expect(isAllowedPhotoUrl("data:image/png;base64,AAAA")).toBe(false)
    expect(isAllowedPhotoUrl("http://example.com/x.jpg")).toBe(false)
    expect(isAllowedPhotoUrl("/")).toBe(false)
    expect(isAllowedPhotoUrl("")).toBe(false)
    expect(isAllowedPhotoUrl("ni url")).toBe(false)
  })
})

describe("fotografije naročila — opis", () => {
  it("poravna presledke in odreže", () => {
    expect(sanitizeCaption("  raztrgan   rob ")).toBe("raztrgan rob")
    expect(sanitizeCaption("   ")).toBeNull()
    expect(sanitizeCaption(null)).toBeNull()
  })

  it("omeji dolžino", () => {
    const long = "a".repeat(200)
    expect(sanitizeCaption(long)).toHaveLength(MAX_PHOTO_CAPTION)
  })
})

describe("fotografije naročila — meje", () => {
  it("dovoli do meje, potem zavrne", () => {
    expect(canAddPhoto({ currentCount: 0, url: "/api/media/x" }).ok).toBe(true)
    expect(
      canAddPhoto({ currentCount: MAX_PHOTOS_PER_ORDER, url: "/api/media/x" })
    ).toEqual({ ok: false, error: "LIMIT_REACHED" })
  })

  it("neveljaven URL zavrne tudi pod mejo", () => {
    expect(canAddPhoto({ currentCount: 0, url: "javascript:1" })).toEqual({
      ok: false,
      error: "INVALID_URL",
    })
  })
})

describe("fotografije naročila — združevanje po stopnjah", () => {
  it("ohrani vrstni red skupin in fotografij", () => {
    const groups = groupPhotosByStage([
      { stageKey: "production", n: 1 },
      { stageKey: null, n: 2 },
      { stageKey: "production", n: 3 },
    ])
    expect(groups.map((g) => g.stageKey)).toEqual(["production", null])
    expect(groups[0].photos.map((p) => p.n)).toEqual([1, 3])
    expect(groups[1].photos.map((p) => p.n)).toEqual([2])
  })
})
