// ============================================================
// DYNAMIC FIELD VALIDATION (EPIC #1 §8 — shared, pure, client-safe)
// One source of truth for validating values against a declarative
// field list (ProfileFieldDef shape): the public inquiry form, the
// admin extension-record registry and any future dynamic surface
// all reuse this so behavior can never drift between surfaces.
// The server ALWAYS re-validates before persisting — the client
// can never inject unknown fields or invalid types.
// ============================================================

export interface ValidatableField {
  key: string
  label: string
  type: string
  required: boolean
  options?: string[]
  /** Faza 2B/2C-1: za entityReference — single (objekt) ali multi (niz) ciljev. UI razreši; org velja server-side. */
  referenceTo?:
    | { extensionId: string; entityKey: string }
    | { extensionId: string; entityKey: string }[]
    | undefined
  unit?: string
  placeholder?: string
}

export interface FieldValidationResult {
  errors: Record<string, string>
  clean: Record<string, unknown>
}

/**
 * Validate submitted values against field definitions.
 * Returns a map of fieldKey → machine error key (required | number |
 * date | option) plus the cleaned, typed values.
 */
export function validateFieldValues(
  fields: ValidatableField[],
  values: Record<string, unknown>
): FieldValidationResult {
  const errors: Record<string, string> = {}
  const clean: Record<string, unknown> = {}

  for (const field of fields) {
    const raw = values[field.key]
    const empty =
      raw === undefined ||
      raw === null ||
      (typeof raw === "string" && raw.trim() === "")

    if (field.required && empty) {
      errors[field.key] = "required"
      continue
    }
    if (empty) continue

    if (field.type === "number") {
      const n = Number(raw)
      if (!Number.isFinite(n)) {
        errors[field.key] = "number"
        continue
      }
      clean[field.key] = n
      continue
    }

    if (field.type === "select") {
      const value = String(raw)
      if (field.options && !field.options.includes(value)) {
        errors[field.key] = "option"
        continue
      }
      clean[field.key] = value
      continue
    }

    if (field.type === "checkbox") {
      clean[field.key] = raw === true || raw === "true" || raw === "on"
      continue
    }

    // Faza 2B/2C-1: entityReference — single (2B) = string id; multi (2C-1) = objekt
    // {id, extensionId, entityKey}. Existence/org-scope se preverjata SERVER-side v
    // records.ts; tukaj (client-safe, deljeno z javnimi obrazci) samo tipski clean.
    if (field.type === "entityReference") {
      const isMulti = Array.isArray(field.referenceTo)
      if (isMulti) {
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
          errors[field.key] = "INVALID_REFERENCE"
          continue
        }
        const obj = raw as Record<string, unknown>
        const id = typeof obj.id === "string" ? obj.id.trim().slice(0, 200) : ""
        const extensionId =
          typeof obj.extensionId === "string" ? obj.extensionId.trim().slice(0, 80) : ""
        const entityKey =
          typeof obj.entityKey === "string" ? obj.entityKey.trim().slice(0, 80) : ""
        if (!id || !extensionId || !entityKey) {
          errors[field.key] = "INVALID_REFERENCE"
          continue
        }
        clean[field.key] = { id, extensionId, entityKey }
        continue
      }
      const id = String(raw).trim()
      if (!id) {
        clean[field.key] = null
        continue
      }
      clean[field.key] = id.slice(0, 200)
      continue
    }

    if (field.type === "date") {
      const d = new Date(String(raw))
      if (Number.isNaN(d.getTime())) {
        errors[field.key] = "date"
        continue
      }
      clean[field.key] = String(raw)
      continue
    }

    // text / textarea — length cap for safety
    const s = String(raw).trim().slice(0, 5000)
    clean[field.key] = s
  }

  return { errors, clean }
}

/** Derive a human title for a record from its validated values:
 *  the first required text/select value, else the first non-empty
 *  short value, else a fallback label. */
export function deriveRecordTitle(
  fields: ValidatableField[],
  values: Record<string, unknown>,
  fallback: string
): string {
  const candidates = fields.filter((f) => f.type === "text" || f.type === "select")
  for (const f of candidates.filter((c) => c.required)) {
    const v = values[f.key]
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 80)
  }
  for (const f of candidates) {
    const v = values[f.key]
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 80)
  }
  return fallback
}
