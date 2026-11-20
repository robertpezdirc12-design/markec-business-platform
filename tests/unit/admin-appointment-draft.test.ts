import { describe, expect, it } from "vitest"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

// U9 — varno stanje formularjev (draft). Admin obrazec za nov termin
// auto-draftira v versioned localStorage, ob ponovnem vstopu zavestno obnovi
// ("Povrni" strip, dismissal), in osnutek izbriše po uspešnem ustvarjanju.

const __dirname = dirname(fileURLToPath(import.meta.url))
const formPath = join(__dirname, "../../src/components/appointments/admin-appointment-form.tsx")
const dictPath = join(__dirname, "../../src/lib/i18n/dict/appointments.ts")

describe("U9 admin appointment draft", () => {
  it("auto-draft se piše v versioned localStorage ključ", async () => {
    const src = await readFile(formPath, "utf8")
    expect(src).toContain('"mec:admin-appt-draft:v1"')
    expect(src).toContain("window.localStorage.getItem(DRAFT_KEY)")
    expect(src).toContain("window.localStorage.setItem(")
  })

  it("shranjevanje je debounced (~600 ms) ob spremembah obrazca", async () => {
    const src = await readFile(formPath, "utf8")
    expect(src).toContain("watch((values) => {")
    expect(src).toContain(".setTimeout(")
    expect(src).toContain(", 600)")
    expect(src).toContain("saveTimer")
  })

  it("ob ponovnem vstopu se osnutek zavestno obnovi in pokaže strip", async () => {
    const src = await readFile(formPath, "utf8")
    expect(src).toContain("setDraftVisible(true)")
    expect(src).toContain('role="status"')
    expect(src).toContain("draftVisible &&")
  })

  it("osnutek se izbriše po uspešnem ustvarjanju in ob 'Zavrzi'", async () => {
    const src = await readFile(formPath, "utf8")
    expect(src).toContain("window.localStorage.removeItem(DRAFT_KEY)")
    expect(src).toContain("discardDraft")
    expect(src).toContain("t.appointments.form.draftDiscard")
    expect(src).toContain("t.appointments.form.draftDismiss")
  })

  it("i18n draft ključi obstajajo v slovenščini in angleščini", async () => {
    const src = await readFile(dictPath, "utf8")
    expect(src).toContain('draftRestored: "Obnovljen neshranjen osnutek terminov"')
    expect(src).toContain('draftRestoredHint: "Podatki iz prejšnjega obiska so bili obnovljeni."')
    expect(src).toContain('draftRestored: "Unsaved appointment draft restored"')
    expect(src).toContain('draftRestoredHint: "Your data from the last session was recovered."')
  })
})