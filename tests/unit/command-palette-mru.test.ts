import { describe, expect, it } from "vitest"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

// U8 — ⌘K prioriteta pogostih akcij (MRU). Regresijska zaščita, da paleta
// pomni nazadnje uporabljene akcije/strani (localStorage), jih ob odprtju
// prikaže kot prvo skupino "Zadnje" in da so iz druge skupin odstranjeni
// dvojniki. Ključ je versioned (CLAUDE.md → pravilo #19).

const __dirname = dirname(fileURLToPath(import.meta.url))
const palettePath = join(__dirname, "../../src/components/admin/command-palette.tsx")
const commonPath = join(__dirname, "../../src/lib/i18n/dict/common.ts")

describe("U8 command palette MRU", () => {
  it("MRU se hrani v versioned localStorage ključu, max 8", async () => {
    const src = await readFile(palettePath, "utf8")
    expect(src).toContain('"mec:palette-recent:v1"')
    expect(src).toContain('localStorage.getItem(RECENT_KEY)')
    expect(src).toContain('localStorage.setItem(RECENT_KEY')
    expect(src).toContain(".slice(0, 8)")
  })

  it("samo akcije/strani/zadnje se pomnijo, ne iskalni zadetki", async () => {
    const src = await readFile(palettePath, "utf8")
    expect(src).toContain('entry.kind !== "action"')
    expect(src).toContain('entry.kind !== "destination"')
    expect(src).toContain('entry.kind !== "recent"')
  })

  it("ob praznem vprašanju gre 'Zadnje' na vrh in dvojniki se izločijo", async () => {
    const src = await readFile(palettePath, "utf8")
    expect(src).toContain("[...recent, ...actionsRest, ...destinationsRest]")
    expect(src).toContain('kind: "recent" as const')
    expect(src).toContain("recentIds.filter")
  })

  it("seznam je razdeljen v skupine in 'recent' je prvi", async () => {
    const src = await readFile(palettePath, "utf8")
    expect(src).toContain('? "recent"')
    expect(src).toContain('entry.kind === "recent"')
    expect(src).toContain('["recent", "results", "destinations", "actions"]')
    expect(src).toContain("t.common.navGroups.recent")
  })

  it("i18n ključ 'recent' obstaja v slovenščini in angleščini", async () => {
    const src = await readFile(commonPath, "utf8")
    expect(src).toContain('recent: "Zadnje"')
    expect(src).toContain('recent: "Recent"')
  })
})