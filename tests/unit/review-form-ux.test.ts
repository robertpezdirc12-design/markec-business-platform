import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// ============================================================
// Reviews (my-orders / landing): AT-status in fokus pri
// oddaji/spremembi ocene. Konsistentno z booking/checkout.
// ============================================================

const ROOT = join(__dirname, "..", "..")
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n")

describe("review-form — AT error/success napoved", () => {
  const f = () => read("src/components/reviews/review-form.tsx")

  it("napake (rating, comment, submit) so role=alert — bralnik jih napove", () => {
    const s = f()
    expect(s).toContain('<p role="alert" className="mt-1 text-sm text-destructive">{errors.rating.message}</p>')
    expect(s).toContain('<p role="alert" className="mt-1 text-sm text-destructive">{errors.comment.message}</p>')
    expect(s).toContain('<div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">')
  })

  it("uspeh je role=status in form ima aria-busy med isPending", () => {
    const s = f()
    expect(s).toContain('<div role="status" className="rounded-md bg-success/10 p-3 text-sm text-success">')
    expect(s).toContain('aria-busy={isPending}')
  })

  it("submit ima spinner + disabled (no double-action)", () => {
    const s = f()
    expect(s).toContain('<Button type="submit" disabled={isPending} className="w-full">')
    expect(s).toContain('<SpinnerGapIcon size={18} className="mr-2 animate-spin" />')
  })
})

describe("edit-review-dialog — AT-status + shranjujem oceno", () => {
  const f = () => read("src/components/reviews/edit-review-dialog.tsx")

  it("napake so role=alert in form ima aria-busy", () => {
    const s = f()
    expect(s).toContain('role="alert" className="text-sm text-destructive">{errors.rating.message}</p>')
    expect(s).toContain('role="alert" className="text-sm text-destructive">{errors.comment.message}</p>')
    expect(s).toContain("aria-busy={isPending}")
  })

  it("med async oddajo napove 'Shranjujem oceno…' preko stalne live regije", () => {
    const s = f()
    expect(s).toContain('<p role="status" className="sr-only" aria-live="polite">')
    expect(s).toContain('{isPending ? "Shranjujem oceno…" : ""}')
    expect(s).toContain('<Button type="submit" disabled={isPending}>')
    expect(s).toContain('<SpinnerIcon size={16} className="mr-2 animate-spin" />')
  })
})

describe("skupni focusFirstFormError je izločen (DRY)", () => {
  it("živi v lib/form-focus in ga uporablja booking-form", () => {
    const lib = read("src/lib/form-focus.ts")
    expect(lib).toContain("export function focusFirstFormError()")
    const b = read("src/components/booking/booking-form.tsx")
    expect(b).toContain('import { focusFirstFormError } from "@/lib/form-focus"')
    // lokalna definicija je bila odstranjena
    expect(b.split("function focusFirstFormError").length).toBeLessThan(2)
  })
})