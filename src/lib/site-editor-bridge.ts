// ============================================================
// F5.3.1 — BRIDGE med vizualnim urejevalnikom (parent) in
// vgrajenim predogledom (iframe na /s/{slug}/preview?edit=1).
//
// Eden vir resnice za tip sporočil + varnostna pravila (origin, tip).
// Obe strani (editor in preview) uporabljata te konstante, da si
// nikoli ne razlagata tujega schaema.
// ============================================================

import type { SiteContent } from "@/lib/site-content"

/** Identifikator, ki ga rodi star osnovni urejevalnik. */
export const EDITOR_SOURCE = "markec-site-editor"
/** Identifikator, ki ga pošlje vgrajeni predogled. */
export const PREVIEW_SOURCE = "markec-site-editor-preview"

export interface EditorToPreviewMessage {
  source: typeof EDITOR_SOURCE
  type: "preview-content"
  contentVersion: number
  content: SiteContent
}

export interface PreviewToEditorMessage {
  source: typeof PREVIEW_SOURCE
  type: "section-select"
  sectionKey: string
}

/** Varno preveri, da je sporočilo prišlo iz ISTEGA vira (same-origin) in s
 *  pričakovanim tipom. Nikoli ne zaupaj `event.data` brez tega checka. */
export function isEditorMessage(data: unknown): data is EditorToPreviewMessage {
  if (typeof data !== "object" || data === null) return false
  const m = data as Record<string, unknown>
  return (
    m.source === EDITOR_SOURCE &&
    m.type === "preview-content" &&
    typeof m.content === "object" &&
    m.content !== null &&
    typeof m.contentVersion === "number"
  )
}

export function isPreviewMessage(data: unknown): data is PreviewToEditorMessage {
  if (typeof data !== "object" || data === null) return false
  const m = data as Record<string, unknown>
  return m.source === PREVIEW_SOURCE && m.type === "section-select"
}

/** True le, ko sporočilo res izhaja iz našega samega izvora (iframe je isti
 *  origin kot editor — /s/[slug]/preview pod istim hostom). */
export function isTrustedOrigin(eventOrigin: string): boolean {
  try {
    return eventOrigin === window.location.origin
  } catch {
    return false
  }
}