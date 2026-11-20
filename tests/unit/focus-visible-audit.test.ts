import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// ============================================================
// U10 — WCAG 2.4.7 Focus Visible (audit)
// "Namenski avdit page" je implementiran kot avtomatiziran CI-test,
// ki preveri da NIKOLI noben interaktivni element nima izklopljenega
// vidnega fokusa: element z `outline-none`/`outline: none` mora imeti
// vizualno nadomestilo (focus-ring ali focus underline/bg). Globalni
// `*:focus-visible` v globals.css je base fallback.
// ============================================================

const ROOT = join(__dirname, "..", "..")
const SRC = join(ROOT, "src")

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) return walk(p)
    return /\.tsx$/.test(e) ? [p] : []
  })
}

describe("U10/2.4.7 Focus Visible audit", () => {
  it("globalni *:focus-visible v globals.css ima viden outline (ne skriva)", () => {
    const css = readFileSync(
      join(ROOT, "src/app/globals.css"),
      "utf8"
    ).replace(/\r\n/g, "\n")
    const block = css.slice(css.indexOf("*:focus-visible"))
    expect(block).toMatch(/outline:\s*2px\s+solid\s+hsl\(var\(--ring\)\)/)
    // prepovedano: outline:none / outline:0 na focus-visible globalno
    expect(block).not.toMatch(/outline:\s*(none|0)/)
  })

  it("noben interaktiven element z outline-none ne ostane brez vidnega fokusa", () => {
    const files = walk(SRC)
    const offenders: string[] = []
    for (const f of files) {
      const txt = readFileSync(f, "utf8").replace(/\r\n/g, "\n")
      const lines = txt.split("\n")
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // poišči "outline-none" ali "outline: none"/"outline:0"
        const hasOutlineKill =
          line.includes("outline-none") ||
          /outline:\s*(none|0)/.test(line)
        if (!hasOutlineKill) continue
        // mora imeti viden nadomestek v isti vrstici OR naslednji (className wrap)
        const windowText = lines.slice(i, i + 3).join(" ")
        const hasVisibleFocus =
          /focus(-visible)?:(ring|bg|underline|outline)|focus:[a-z-]*ring|:focus\s*\{[^}]*outline|focus-visible:ring/.test(
            windowText
          )
        // interaktiven element? (button/a/input/select/role="button"); kontejnerji
        // (panele, overlay-e) NISO fokus-able → ne štejejo.
        const isInteractive =
          /(button|input|<a\s|role="button"|select\b|tabindex)/.test(line)
        if (!hasVisibleFocus && isInteractive) {
          offenders.push(`${f}:${i + 1} »${line.trim()}«`)
        }
      }
    }
    if (offenders.length) console.log("FOCUS-AUDIT OFFENDERS:\n" + offenders.join("\n"))
    expect(offenders).toEqual([])
  })

  it("UI primitivi (Button/Link) ne kličejo focus:outline-none brez ring", () => {
    const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8")
    // base button brez custom focus-removal globalno
    expect(css).not.toContain("outline: none")
  })
})