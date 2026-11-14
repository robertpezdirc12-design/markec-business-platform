"use client"

// ============================================================
// F5.0 — SKD 2025 hierarchy browser.
//
// Dril-down od področja (A–V) do konkretnega podrazreda (raven 5),
// z uradnim imenom in šifro. Ko uporabnik izbere podrazred, se pokliče
// `onSelectSubclass(code)`; starš nato razreši poslovni profil
// (resolveSkdProfile) in zabeleži izbiro.
//
// Client-safe: podatki pridejo iz src/lib/skd/data/skd2025.ts (generirana
// datoteka — uradni SURS KLASJE podatki, brez prisma).
// ============================================================

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  SKD_RECORDS,
  skdByCode,
  type SkdRecord,
} from "@/lib/skd/data/skd2025"

export interface SkdHierarchyBrowserProps {
  /** Selected subclass code (level 5), e.g. "T96.210". */
  value: string | null
  /** Called when a concrete subclass is chosen. */
  onSelectSubclass: (code: string) => void
  disabled?: boolean
}

interface TreeNode {
  record: SkdRecord
  children: TreeNode[]
}

/** Build the tree of all 1725 SKD records (children keyed by parent). */
function buildTree(): { nodes: Map<string, TreeNode>; roots: TreeNode[] } {
  const nodes = new Map<string, TreeNode>(
    SKD_RECORDS.map((r) => [r.c, { record: r, children: [] }])
  )
  const roots: TreeNode[] = []
  for (const r of SKD_RECORDS) {
    const node = nodes.get(r.c)!
    if (r.p && nodes.has(r.p)) nodes.get(r.p)!.children.push(node)
    else roots.push(node)
  }
  return { nodes, roots }
}

const { nodes: TREE, roots: ROOTS } = buildTree()

function levelLabel(l: number): string {
  switch (l) {
    case 1: return "Področje"
    case 2: return "Oddelek"
    case 3: return "Skupina"
    case 4: return "Razred"
    case 5: return "Podrazred"
    default: return ""
  }
}

export function SkdHierarchyBrowser({
  value,
  onSelectSubclass,
  disabled = false,
}: SkdHierarchyBrowserProps) {
  const [open, setOpen] = useState(false)
  // Breadcrumb of expanded nodes from the section down.
  const [path, setPath] = useState<string[]>([]) // list of codes, e.g. ["T","T96","T96.2","T96.21"]

  // Track a local key to re-open on reselect.
  const selectedRec = value ? skdByCode(value) : null

  // Current level: children of the last path node (or roots if empty).
  const currentNode = useMemo(() => {
    if (path.length === 0) return { record: null as unknown as SkdRecord, children: ROOTS }
    return TREE.get(path[path.length - 1])
  }, [path])

  function drill(code: string) {
    setPath((p) => [...p, code])
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-expanded={open}
        disabled={disabled}
        className={cn(
          "border-input bg-background flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-4 py-2 text-left text-sm transition-colors hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-primary ring-2 ring-primary/20"
        )}
      >
        <span className={cn("min-w-0 truncate", !selectedRec && "text-muted-foreground")}>
          {selectedRec
            ? `${selectedRec.c} · ${selectedRec.sl}`
            : "Izberite natančno dejavnost (SKD 2025 podrazred) — npr. frizer, mehanik, mesar…"}
        </span>
        <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform" />
      </button>

      {open && (
        <div className="bg-background border-border/60 mt-2 max-h-96 overflow-y-auto rounded-xl border p-2 shadow-xl">
          {/* Breadcrumb */}
          {path.length > 0 && (
            <div className="sticky top-0 z-10 mb-1 flex flex-wrap items-center gap-1 bg-background pb-2 text-xs">
              <button
                type="button"
                onClick={() => setPath([])}
                className="text-muted-foreground hover:text-foreground rounded px-1 py-0.5"
              >
                Področja
              </button>
              {path.map((code, i) => {
                const rec = skdByCode(code)
                if (!rec) return null
                const isLast = i === path.length - 1
                return (
                  <span key={code} className="flex items-center gap-1">
                    <span className="text-muted-foreground">/</span>
                    <button
                      type="button"
                      onClick={() => setPath(path.slice(0, i + 1))}
                      className={cn(
                        "rounded px-1 py-0.5",
                        isLast ? "font-medium" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {rec.c} {rec.sl.length > 20 ? rec.sl.slice(0, 20) + "…" : rec.sl}
                    </button>
                  </span>
                )
              })}
            </div>
          )}

          {currentNode && currentNode.children.length > 0 ? (
            <div className="space-y-0.5">
              {currentNode.children.map((child) => {
                const r = child.record
                const hasChildren = child.children.length > 0
                const isLeaf = r.l === 5
                const isSelected = value === r.c
                return (
                  <div key={r.c} className="flex items-center gap-1">
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => drill(r.c)}
                        aria-label={`Odpri ${r.c} ${r.sl}`}
                        className="text-muted-foreground hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded"
                      >
                        <ChevronRight className="size-4" aria-hidden />
                      </button>
                    ) : (
                      <span className="size-7 shrink-0" />
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        if (isLeaf) {
                          onSelectSubclass(r.c)
                          setOpen(false)
                        } else {
                          drill(r.c)
                        }
                      }}
                      className={cn(
                        "hover:bg-primary/5 flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                        isSelected && "bg-primary/10 font-medium",
                        isLeaf && !isSelected && "cursor-pointer"
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block">
                          <span className="font-mono text-xs font-semibold">{r.c}</span>{" "}
                          <span>{r.sl}</span>
                        </span>
                      </span>
                      <span className="text-muted-foreground shrink-0 text-[10px] uppercase tracking-wide">
                        {levelLabel(r.l)}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground p-3 text-center text-sm">
              Izberite podrazred (raven 5) zgoraj.
            </p>
          )}
        </div>
      )}
    </div>
  )
}