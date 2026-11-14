"use client"

// F5.3.2 — PANEL ZA OBLIKOVNE PREDLOGE (predloge spletnih strani).
// Podjetnik prebere predlogo → predogled (barvn a vzorec + vrstni red sekcij) →
// izbere. Ob izbiri se NIKOLI ne izbrišejo besedila/fotografije (applyTemplate
// shrani le marker _templateId + po potrebi uskladi vrstni red; vsebina ostane).

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { applyTemplate } from "@/app/actions/site-content"
import { PALETTES } from "@/lib/verticals"
import { templatesFor, getTemplate, type SiteTemplate } from "@/lib/site-design"

function TemplateCard({
  tpl,
  active,
  onApply,
  busy,
}: {
  tpl: SiteTemplate
  active: boolean
  onApply: () => void
  busy: boolean
}) {
  const pal = PALETTES[tpl.basePaletteId] ?? PALETTES.rose
  return (
    <li className="overflow-hidden rounded-lg border bg-white/40">
      <div className="h-14 w-full border-b" style={{ background: `hsl(${pal.primaryHue} ${pal.primarySat}% ${pal.primaryL}%)` }}>
        <div className="flex h-full items-end gap-1 p-2">
          <span className="h-6 w-6 rounded-sm" style={{ background: `hsl(${pal.accentHue} ${pal.accentSat}% ${pal.accentL}%)` }} />
          <span className="h-3 w-14 rounded-sm bg-white/70" />
          <span className="h-2 w-10 rounded-sm bg-white/40" />
        </div>
      </div>
      <div className="space-y-1 p-2.5">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-medium">{tpl.name}</span>
          {active && <Badge className="bg-primary/10 text-primary">Aktivna</Badge>}
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">{tpl.description}</p>
        <div className="flex flex-wrap gap-1 pt-1">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{tpl.layout}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{pal.label}</span>
        </div>
        <Button size="sm" className="mt-1.5" onClick={onApply} disabled={busy || active}>
          {active ? "V uporabi" : busy ? "Uporabljam…" : "Uporabi"}
        </Button>
      </div>
    </li>
  )
}

export function TemplatesPanel({
  vertical,
  capabilitiesEnabled,
  currentTemplateId,
  verticalLabel,
}: {
  vertical: string | null
  capabilitiesEnabled: string[]
  currentTemplateId?: string
  verticalLabel?: string
}) {
  const [busy, setBusy] = useState(false)
  const templates = templatesFor({ vertical, capabilitiesEnabled })
  const active = getTemplate(currentTemplateId ?? "") ?? null

  const apply = async (id: string) => {
    setBusy(true)
    const res = await applyTemplate(id)
    setBusy(false)
    if (res.success) {
      toast.success("Predloga uporabljena — vaša vsebina je ohranjena (osnutek).")
    } else {
      toast.error("Uporaba predloge ni uspela.")
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Oblikovne predloge</h4>
      <p className="text-xs text-muted-foreground">
        Izberite videz svoje spletne strani. Menjava predloge nikoli ne izbriše vaših besedil,
        fotografij, storitev in izdelkov — shranjena je le kot osnutek.
        {verticalLabel ? ` (${verticalLabel})` : ""}
      </p>
      {active && (
        <p className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
          Trenutna predloga: <strong>{active.name}</strong>.
        </p>
      )}
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {templates.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            tpl={tpl}
            active={tpl.id === currentTemplateId}
            onApply={() => apply(tpl.id)}
            busy={busy}
          />
        ))}
        {templates.length === 0 && (
          <li className="col-span-full rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Za vašo dejavnost trenutno ni na voljo dodatnih predlog.
          </li>
        )}
      </ul>
    </div>
  )
}