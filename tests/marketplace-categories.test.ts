// ============================================================
// TRŽNICA — izpostavljene kategorije na naslovnici.
//
// Čipi pod iskalnikom so prej kazali samo lepotne kategorije in so
// peljali na /podjetja?kategorija=<poljuben niz>, kar je znalo vrniti
// 0 zadetkov. Zdaj pridejo iz registra in vodijo na /kategorije/<slug>.
// Ta test varuje natipkane slug-e: če se v registru preimenuje, test
// pade, namesto da bi uporabnik dobil 404.
// ============================================================

import { describe, expect, it } from "vitest"

import {
  FEATURED_CATEGORY_SLUGS,
  MARKETPLACE_CATEGORIES,
  getFeaturedCategories,
  getMarketplaceCategory,
} from "@/lib/marketplace/categories"

describe("izpostavljene kategorije tržnice", () => {
  it("vsak slug obstaja v registru", () => {
    const missing = FEATURED_CATEGORY_SLUGS.filter(
      (slug) => getMarketplaceCategory(slug) === null
    )
    expect(missing).toEqual([])
  })

  it("vrne natanko toliko kategorij, kolikor je slugov", () => {
    expect(getFeaturedCategories()).toHaveLength(FEATURED_CATEGORY_SLUGS.length)
  })

  it("ne ponovi iste kategorije", () => {
    expect(new Set(FEATURED_CATEGORY_SLUGS).size).toBe(FEATURED_CATEGORY_SLUGS.length)
  })

  it("ni samo lepota — izpostavi vsaj tri različne panoge", () => {
    const firstVerticals = getFeaturedCategories().map((c) => c.verticals[0])
    expect(new Set(firstVerticals).size).toBeGreaterThanOrEqual(3)
    expect(firstVerticals).toContain("beekeeping")
  })

  it("vsaka kategorija ima angleško oznako", () => {
    const missing = MARKETPLACE_CATEGORIES.filter((c) => !c.labelEn.trim())
    expect(missing.map((c) => c.slug)).toEqual([])
  })
})
