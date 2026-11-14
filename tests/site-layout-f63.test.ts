// ============================================================
// F6.3 — LAYOUT MANIFEST po dejavnosti (rezultat strukture, ne barve).
//
// Preveri, da renderer dobi DEJANSKO različno strukturo (hero varianta +
// primarna hierarhija) za različne poslovne profile — ne da bi se samo
// zamenjala barva/tema. Ključno za vizijo F6: »mehanik ni samo frizer
// z drugimi fotografijami«.
// ============================================================

import { describe, it, expect } from "vitest"
import {
  resolveLayout,
  defaultTemplateForProfile,
  DEFAULT_MANIFEST,
  type LayoutManifest,
} from "@/lib/site-layout"

describe("F6.3 defaultTemplateForProfile — različne dejavnosti → različna privzeta predloga", () => {
  it("delavniški/servisni → modern (split hero)", () => {
    expect(defaultTemplateForProfile("mehanik")).toBe("modern-bold")
    expect(defaultTemplateForProfile("tire-service")).toBe("modern-bold")
  })
  it("lepota/rezervacijski → klasična (centered)", () => {
    expect(defaultTemplateForProfile("frizer")).toBe("classic-elegant")
    expect(defaultTemplateForProfile("beauty")).toBe("classic-elegant")
  })
  it("šivilja/pridelovalec → minimal", () => {
    expect(defaultTemplateForProfile("seamstress")).toBe("minimal-light")
    expect(defaultTemplateForProfile("beekeeping")).toBe("minimal-light")
  })
  it("neznano (generic) → varni fallback", () => {
    expect(defaultTemplateForProfile(undefined)).toBe("classic-elegant")
    expect(defaultTemplateForProfile(null)).toBe("classic-elegant")
    expect(defaultTemplateForProfile("neznan")).toBe("classic-elegant")
  })
})

describe("F6.3 resolveLayout — dejanska strukturna razlika po dejavnosti", () => {
  it("mehanik dobi split hero (struktura: besedilo + slika) + delovni nalog kot primarno", () => {
    const l = resolveLayout(defaultTemplateForProfile("mehanik"), "mehanik")
    expect(l.heroVariant).toBe("split")
    expect(l.primary).toBe("workflow")
    expect(l.prominentCta).toBe(true)
  })

  it("frizer dobi centered hero + storitve (rezervacijski vzorec)", () => {
    const l = resolveLayout(defaultTemplateForProfile("frizer"), "frizer")
    expect(l.heroVariant).toBe("centered")
    expect(l.primary).toBe("services")
  })

  it("šivilja dobi minimal hero + povpraševanje (skromna predstava)", () => {
    const l = resolveLayout(defaultTemplateForProfile("seamstress"), "seamstress")
    expect(l.heroVariant).toBe("minimal")
    expect(l.primary).toBe("workflow")
    expect(l.showStats).toBe(false)
  })

  it("čebelar dobi minimal hero + izdelki kot primarno (ne storitve)", () => {
    const l = resolveLayout(defaultTemplateForProfile("beekeeping"), "beekeeping")
    expect(l.heroVariant).toBe("minimal")
    expect(l.primary).toBe("products")
    expect(l.showStats).toBe(false)
  })

  it("generic (nepreverjen profil) ostane na varnem privzetem manifestu", () => {
    const l = resolveLayout(null, undefined)
    expect(l).toEqual(DEFAULT_MANIFEST)
    expect(l.heroVariant).toBe("centered")
  })

  it("template impl iz oblike: modern-bold + beauty → outro mej se ne preklapljajo", () => {
    // Tudi če lastnik izbere "modern-bold" v frizerju, frizer (dejavnost)
    // ohrani centered strukturo (funkcionalna zahteva gre pred obliko).
    const l = resolveLayout("modern-bold", "frizer")
    expect(l.heroVariant).toBe("centered")
    expect(l.primary).toBe("services")
  })
})