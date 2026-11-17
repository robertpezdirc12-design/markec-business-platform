// ============================================================
// Preslikava javnega obrazca → delovno naročilo (čiste funkcije)
//
// Ločeno od `src/app/actions/forms.ts`, da jih je mogoče testirati brez
// Next.js strežniškega okolja (auth, next/headers) in da se ne vlečejo v
// noben odjemalski paket.
// ============================================================

/** Ključi, ki opisujejo PREDMET naročila (imajo prednost pri naslovu). */
const SUBJECT_KEYS = [
  "garment_type",
  "garmenttype",
  "item",
  "subject",
  "title",
  "product",
  "service",
  "topic",
]

/** Ključi, iz katerih beremo rok izdelave. */
const DUE_KEYS = ["deadline", "due_date", "duedate", "rok", "date"]

/** Vrednosti, ki niso primeren naslov (datumi, številke, e-pošta, URL). */
function looksLikeNoise(value: string): boolean {
  const v = value.trim()
  if (v.length < 3) return true
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return true // datum
  if (/^\d+([.,]\d+)?$/.test(v)) return true // število
  if (v.includes("@")) return true // e-pošta
  if (/^https?:\/\//.test(v)) return true // URL
  return false
}

/**
 * Naslov naročila iz vrednosti obrazca.
 *
 * Prej je vzel PRVO neprazno besedilno polje — pri šiviljskem obrazcu je bil
 * to datum, zato je seznam naročil kazal »Podrobnosti naročila: 2026-12-05«.
 */
export function buildWorkOrderTitle(
  values: Record<string, unknown>,
  formName: string
): string {
  const entries = Object.entries(values).filter(
    ([, v]) => typeof v === "string" && !looksLikeNoise(String(v))
  )

  const bySubject = entries.find(([k]) => SUBJECT_KEYS.includes(k.toLowerCase()))
  const chosen = bySubject ?? entries.find(([, v]) => String(v).length <= 80)

  if (!chosen) return formName
  return String(chosen[1]).trim().slice(0, 80)
}

/** Rok izdelave iz obrazca (deadline / due_date / rok / date) — ali null. */
export function parseFormDueDate(values: Record<string, unknown>): Date | null {
  const raw = Object.entries(values).find(([k]) =>
    DUE_KEYS.includes(k.toLowerCase())
  )?.[1]
  if (typeof raw !== "string" || raw.trim() === "") return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Polja merilnega lista (skladna z extensionom `seamstress-measurements`). */
export const MEASUREMENT_FIELDS = [
  "chest_cm",
  "waist_cm",
  "hips_cm",
  "shoulder_cm",
  "sleeve_cm",
  "inseam_cm",
  "height_cm",
] as const

/**
 * Iz vrednosti obrazca pobere samo polja merilnega lista in jih pretvori v
 * števila (cm). Vrne `null`, kadar obrazec ni merilni list — takrat se
 * merilni zapis ne ustvarja.
 */
export function extractMeasurementValues(
  values: Record<string, unknown>
): Record<string, number> | null {
  const out: Record<string, number> = {}
  for (const key of MEASUREMENT_FIELDS) {
    const raw = values[key]
    if (raw === undefined || raw === null || raw === "") continue
    const n = Number(String(raw).replace(",", "."))
    if (Number.isFinite(n) && n > 0 && n < 300) out[key] = n
  }
  return Object.keys(out).length > 0 ? out : null
}

/** Datum meritve (YYYY-MM-DD) — danes, če obrazec datuma ne vsebuje. */
export function measurementDate(values: Record<string, unknown>): string {
  const raw = values.measured_at ?? values.measurement_date ?? values.date
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return new Date().toISOString().slice(0, 10)
}
