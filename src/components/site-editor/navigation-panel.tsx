"use client"

// F5.3.2 — PANEL ZA GLAVNI MENI (navigacijo). Ureja SiteContent.nav.
// Ponuja notranje povezave (sekcije/strani) in zunanje URL-je; capability-gated
// (ne prikaže izklopljenih funkcij); skrivanje/razvrščanje/imenovanje.

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronUpIcon, ChevronDownIcon, TrashIcon, PlusIcon } from "@/components/icons"
import type { SiteContent } from "@/lib/site-content"
import { availableNavTargets, normalizeNav, type NavItem } from "@/lib/site-design"

export function NavigationPanel({
  content,
  capabilitiesEnabled,
  onChange,
}: {
  content: SiteContent
  capabilitiesEnabled: string[]
  onChange: (c: SiteContent) => void
}) {
  const [newHref, setNewHref] = useState("#about")
  const [newLabel, setNewLabel] = useState("")
  const [adding, setAdding] = useState(false)
  // stabilen števec ID-jev (ni impure klica med renderom)
  const idCounter = useRef(0)
  const nextId = () => `n${(++idCounter.current).toString(36)}`

  const nav: NavItem[] = normalizeNav(content.nav) ?? []

  const push = (next: NavItem[]) => {
    const withOrder = next.map((n, i) => ({ ...n, order: i }))
    onChange({ ...content, nav: withOrder })
  }

  const move = (id: string, dir: -1 | 1) => {
    const i = nav.findIndex((n) => n.id === id)
    if (i === -1) return
    const j = i + dir
    if (j < 0 || j >= nav.length) return
    const list = [...nav]
    ;[list[i], list[j]] = [list[j], list[i]]
    push(list)
  }
  const toggleVisible = (id: string) =>
    push(nav.map((n) => (n.id === id ? { ...n, visible: !n.visible } : n)))
  const remove = (id: string) => push(nav.filter((n) => n.id !== id))
  const setLabel = (id: string, label: string) =>
    push(nav.map((n) => (n.id === id ? { ...n, label } : n)))

  const targets = availableNavTargets(capabilitiesEnabled)
  const selected = targets.find((t) => t.value === newHref)
  const labelForNew = newLabel.trim() || selected?.label || newHref

  const addItem = () => {
    const isExternal = /^https?:\/\//i.test(newHref)
    const newItem: NavItem = {
      id: nextId(),
      label: labelForNew,
      href: newHref,
      sectionId: selected?.sectionId,
      external: isExternal,
      visible: true,
      order: nav.length,
      requiresCapability: selected?.requiresCapability,
    }
    push([...nav, newItem])
    setNewLabel("")
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Glavni meni</h4>
      <p className="text-xs text-muted-foreground">
        Uredite povezave v zgornjem meniju. Povezave do izklopljenih funkcij se ne prikažejo.
      </p>

      {/* Dodaj */}
      <div className="space-y-1.5 rounded-md border p-2">
        {adding ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Povezava</Label>
              <Select value={newHref} onValueChange={(v) => setNewHref(v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {targets.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Zunanji URL (opcijsko namesto zgornjega)</Label>
              <Input
                className="h-8 text-sm"
                placeholder="https://example.si"
                value={/^https?:\/\//i.test(newHref) ? newHref : ""}
                onChange={(e) => setNewHref(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ime (opcijsko)</Label>
              <Input className="h-8 text-sm" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder={labelForNew} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={addItem}><PlusIcon size={14} className="mr-1" />Dodaj</Button>
              <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Prekliči</Button>
            </div>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <PlusIcon size={14} className="mr-1" />Dodaj povezavo
          </Button>
        )}
      </div>

      {/* Lista */}
      <ul className="space-y-1">
        {nav.map((item, idx) => (
          <li key={item.id} className="rounded-md border p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm">
                {item.label}
                {!item.visible && <span className="ml-2 text-xs text-muted-foreground">(skrito)</span>}
              </span>
              <div className="flex items-center gap-0.5">
                <button className="rounded p-1 text-muted-foreground hover:bg-accent" onClick={() => move(item.id, -1)} disabled={idx === 0} title="Gor"><ChevronUpIcon size={14} /></button>
                <button className="rounded p-1 text-muted-foreground hover:bg-accent" onClick={() => move(item.id, 1)} disabled={idx === nav.length - 1} title="Dol"><ChevronDownIcon size={14} /></button>
                <button className="rounded p-1 text-muted-foreground hover:bg-accent" onClick={() => toggleVisible(item.id)} title="Pokaži / skrij">
                  {item.visible ? "👁" : "🙈"}
                </button>
                <button className="rounded p-1 text-destructive hover:bg-accent" onClick={() => remove(item.id)} title="Odstrani"><TrashIcon size={14} /></button>
              </div>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <Label className="text-[10px] text-muted-foreground">Ime</Label>
              <Input className="h-7 text-xs" value={item.label} onChange={(e) => setLabel(item.id, e.target.value)} />
            </div>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{item.href}</p>
          </li>
        ))}
        {nav.length === 0 && (
          <li className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Meni še ni urejan — prikazan bo privzeti meni glede na vaše module.
          </li>
        )}
      </ul>
    </div>
  )
}