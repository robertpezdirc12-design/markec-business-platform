/**
 * Server-safe helper: prefix a path with the tenant slug.
 * orgPath("salon-luna", "/services") => "/s/salon-luna/services"
 * orgPath(null, "/services") => "/services" (default org)
 */
export function orgPath(slug: string | null | undefined, path: string): string {
  // Defense-in-depth (XSS): owner-editable hrefs (CTA, custom sections) are
  // validated on write, but older rows or direct DB edits may still carry a
  // dangerous scheme. Never let `javascript:`/`data:`/`vbscript:` reach an
  // <a href> — fall back to the tenant home instead.
  if (/^\s*(?:javascript|data|vbscript|file|blob)\s*:/i.test(path)) {
    return slug ? `/s/${slug}` : "/"
  }
  if (!slug || !path.startsWith("/")) return path
  // Idempotent guard: stored content may already embed this tenant's
  // prefix (e.g. owner-edited "/s/{slug}/booking") — never double-prefix.
  if (path === `/s/${slug}` || path.startsWith(`/s/${slug}/`)) return path
  const suffix = path === "/" ? "" : path
  return `/s/${slug}${suffix}`
}
