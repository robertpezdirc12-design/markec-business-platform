import { describe, it, expect } from "vitest"
import { existsSync } from "node:fs"
import { join } from "node:path"
import {
  CARD_IMAGE_PATHS,
  DEFAULT_CARD_IMAGE,
  verticalCardImage,
} from "@/lib/marketplace/card-image"
import { getShowcase, type SnapshotBusiness } from "@/lib/marketplace/snapshot"

// ============================================================
// Regresijski testi za marketplace kartice (audit 2026-11-17)
//
// 1. Vsaka nadomestna slika mora RES obstajati v public/ — prej je
//    generator pisal "/img/presets/default.jpg", ki ni nikoli obstajala,
//    zato so bile vse kartice brez logotipa razbite.
// 2. Kategorije (Priporočeno/Priljubljeno/Novo) si ne smejo deliti
//    podjetij — prej je 6 podjetij z 0 mnenj ustvarilo 18 kartic.
// ============================================================

function business(overrides: Partial<SnapshotBusiness>): SnapshotBusiness {
  return {
    id: "id-1",
    name: "Podjetje",
    type: "Storitev",
    address: "Slovenija",
    rating: 0,
    reviews: 0,
    image: null,
    slug: "podjetje",
    category: "generic",
    city: "Slovenija",
    ...overrides,
  }
}

describe("marketplace kartice: nadomestne slike", () => {
  it("vsaka pot iz CARD_IMAGE_PATHS obstaja v public/", () => {
    for (const path of CARD_IMAGE_PATHS) {
      expect(existsSync(join(process.cwd(), "public", path)), path).toBe(true)
    }
  })

  it("neznana ali prazna dejavnost dobi nevtralno rezervo, ki obstaja", () => {
    expect(verticalCardImage(null)).toBe(DEFAULT_CARD_IMAGE)
    expect(verticalCardImage("ne-obstaja")).toBe(DEFAULT_CARD_IMAGE)
    expect(existsSync(join(process.cwd(), "public", DEFAULT_CARD_IMAGE))).toBe(true)
  })

  it("različne dejavnosti dobijo različne slike (isti izbor kot VERTICAL_IMAGERY)", () => {
    const images = new Set(
      ["barber", "massage", "seamstress", "apparel", "tattoo-studio", "mehanik", "beekeeping", "generic"].map(
        (v) => verticalCardImage(v)
      )
    )
    // 8 različnih dejavnosti → 8 različnih slik (prej: ena sama za vse).
    expect(images.size).toBe(8)
  })
})

describe("marketplace kartice: kategorije se ne ponavljajo", () => {
  it("vsako podjetje se prikaže natanko enkrat", () => {
    const businesses = [
      business({ id: "a", rating: 4.9, reviews: 10 }),
      business({ id: "b", rating: 4.5, reviews: 40 }),
      business({ id: "c", rating: 4.2, reviews: 3 }),
      business({ id: "d" }),
      business({ id: "e" }),
      business({ id: "f" }),
    ]

    const showcase = getShowcase(businesses)
    const all = [...showcase.recommended, ...showcase.popular, ...showcase.new]
    const ids = all.map((b) => b.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(all.length).toBe(businesses.length)
  })

  it("podjetja brez mnenj niso Priporočena/Priljubljena — so Nova", () => {
    const businesses = [business({ id: "x" }), business({ id: "y" })]

    const showcase = getShowcase(businesses)

    // Podnaslov obeta ocene, zato 0 mnenj NE more biti "priporočeno".
    expect(showcase.recommended.length).toBe(0)
    expect(showcase.popular.length).toBe(0)
    expect(showcase.new.map((b) => b.id)).toEqual(["x", "y"])
  })

  it("najbolje ocenjeno pride v Priporočeno, najbolj komentirano v Priljubljeno", () => {
    const businesses = [
      business({ id: "topRating", rating: 5, reviews: 2 }),
      business({ id: "topReviews", rating: 4, reviews: 99 }),
      business({ id: "filler" }),
    ]

    const showcase = getShowcase(businesses)

    expect(showcase.recommended[0].id).toBe("topRating")
    expect(showcase.popular[0].id).toBe("topReviews")
  })
})
