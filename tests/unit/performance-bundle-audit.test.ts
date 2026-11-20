import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// ============================================================
// Perfome vprašanje -> UX (audit bundle). Temeljni Next/React pravila
// sledimo: (1) težke knjižnice (react-hook-form, zod, date-fns, Cloudinary)
// na landing se naložijo dynamic (off-init), ne eager ob vsakem obiskovalcu;
// (2) veliki admin editorji so izolirani v admin route — ne zvišajo javni
// (public/booking/shop) bundle za obiskovalce.
// ============================================================

const ROOT = join(__dirname, "..", "..")
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n")

describe("performance-as-UX audit (bundle)", () => {
  it("težka review-form je na landing naložena dynamic, ne eager", () => {
    const src = read("src/components/landing/testimonials-section.tsx")
    expect(src).toContain('import dynamic from "next/dynamic"')
    // ReviewForm (react-hook-form + zod + date-fns) se uvozi z next/dynamic
    expect(src).toContain("ReviewForm = dynamic(")
    expect(src).toContain('() => import("@/components/reviews/review-form")')
  })

  it("veliki admin editorji niso v public/customer app (izolacija route)", () => {
    // največje komponente morajo biti dosegljive le znotraj (admin)/dashboard,
    // da javni (public/booking/shop) bundle za obiskovalce ostaja lahek.
    for (const p of [
      "src/components/dashboard/branding-editor.tsx",
      "src/components/admin/catalog/documents-client.tsx",
      "src/components/dashboard/product-form.tsx",
    ] as const) {
      // preveri da obstajajo (so v admin uporabni) in niso uvoženi nikjer
      // pod src/app/(public) ali src/app/(customer).
      expect(read(p).length, `${p} naj bi obstajal`).toBeGreaterThan(1000)
    }
    const publicFiles = globUnder(["src/app/(public)", "src/app/(customer)"])
    for (const f of publicFiles) {
      const txt = read(f)
      expect(txt, `${f} — težek editor na javni poti`).not.toContain(
        "branding-editor"
      )
      expect(txt, `${f} — težek editor na javni poti`).not.toContain(
        "documents-client"
      )
      expect(txt, `${f} — težek editor na javni poti`).not.toContain(
        "product-form"
      )
    }
  })
})

import { readdirSync, statSync } from "node:fs"
import { relative } from "node:path"
function globUnder(dirs: string[]): string[] {
  return dirs.flatMap((d) => {
    const base = join(ROOT, d)
    const out: string[] = []
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const f = join(dir, e)
        const s = statSync(f)
        if (s.isDirectory()) walk(f)
        else if (/\.tsx?$/.test(e)) out.push(relative(ROOT, f))
      }
    }
    walk(base)
    return out
  })
}