// F1 #100 — VSTOPNA TABLA: čisto jedro brez odvisnosti od Next/DB.
// Ločeno od server actiona (ki vleče next-auth/prisma), da je testabilno
// v vitest enakovredno drugim čistim jedem v projektu (npr. memberships).
import { listProfileOptions } from "./registry"

/** Dejavnostni label iz profile registra (znana vertikala → ime, sicer null). */
export function verticalLabelFor(vertical: string | null): string | null {
  if (!vertical) return null
  return listProfileOptions().find((p) => p.id === vertical)?.label ?? null
}
