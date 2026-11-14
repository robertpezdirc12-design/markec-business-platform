"use client"

// F5.3.2 — PANEL ZA BARVE IN PISAVE (grafična podoba).
// Ureja lastnikovo temo v SalonConfig.theme. Kontrast/berljivost se validira
// strežniško v updateTheme; tukaj prikažemo napake/opozorila. Vsaka sprememba
// je takoj vidna v iframe predogledu (isti RootLayout vbrizga --f532-*).

import { useState } from "react"
import { toast } from "sonner"
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
import { updateTheme } from "@/app/actions/site-content"
import { FONT_LABELS, type FontKey } from "@/lib/verticals"
import {
  DEFAULT_TYPOGRAPHY,
  DEFAULT_THEME_COLORS,
  type SiteTheme,
} from "@/lib/site-design"

const COLOR_FIELDS: { key: keyof SiteTheme["colors"]; label: string }[] = [
  { key: "primary", label: "Glavna barva" },
  { key: "secondary", label: "Sekundarna barva" },
  { key: "accent", label: "Poudarjena barva" },
  { key: "background", label: "Ozadje" },
  { key: "backgroundAlt", label: "Ozadje sekcij" },
  { key: "text", label: "Besedilo" },
  { key: "textMuted", label: "Manj poudarjeno besedilo" },
  { key: "heading", label: "Naslovi" },
  { key: "link", label: "Povezave" },
  { key: "buttonText", label: "Besedilo gumba" },
  { key: "buttonBackground", label: "Ozadje gumba" },
]

const FONT_KEYS = Object.keys(FONT_LABELS) as FontKey[]

export function ThemePanel({
  initial,
  onSaved,
}: {
  initial: SiteTheme | null
  onSaved?: () => void
}) {
  const [theme, setTheme] = useState<SiteTheme>({
    colors: { ...(initial?.colors ?? {}) },
    typography: { ...(initial?.typography ?? {}) },
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])

  const col = { ...DEFAULT_THEME_COLORS, ...theme.colors }
  const typo = { ...DEFAULT_TYPOGRAPHY, ...theme.typography }

  const setColor = (key: keyof SiteTheme["colors"], value: string) =>
    setTheme((t) => ({ ...t, colors: { ...t.colors, [key]: value } }))
  const setTypo = (patch: Partial<SiteTheme["typography"]>) =>
    setTheme((t) => ({ ...t, typography: { ...t.typography, ...patch } }))

  const save = async () => {
    setSaving(true)
    setErrors([])
    setWarnings([])
    const res = await updateTheme(theme)
    setSaving(false)
    if (!res.success) {
      if ("errors" in res && res.errors?.length) {
        setErrors(res.errors)
        toast.error("Preverite barve — stran bi bila nečitljiva.")
        return
      }
      toast.error("Shranjevanje ni uspelo.")
      return
    }
    setWarnings(res.warnings ?? [])
    toast.success("Barve in pisave shranjene (osnutek).")
    onSaved?.()
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Barve in pisave</h4>
      <p className="text-xs text-muted-foreground">
        Spremembe so takoj vidne v predogledu. Objavljene so šele z »Objavi«.
      </p>

      {/* Barve */}
      <div className="grid grid-cols-2 gap-2.5">
        {COLOR_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs">{f.label}</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(col[f.key]) ? col[f.key] : "#000000"}
                onChange={(e) => setColor(f.key, e.target.value)}
                className="h-8 w-9 cursor-pointer rounded border bg-transparent"
                aria-label={f.label}
              />
              <Input
                value={col[f.key]}
                onChange={(e) => setColor(f.key, e.target.value)}
                className="h-8 font-mono text-xs"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Pisave */}
      <div className="space-y-2.5">
        <div className="space-y-1">
          <Label className="text-xs">Pisava naslovov</Label>
          <Select value={typo.fontHeading} onValueChange={(v) => setTypo({ fontHeading: v as FontKey })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{FONT_KEYS.map((k) => <SelectItem key={k} value={k}>{FONT_LABELS[k]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Pisava besedila</Label>
          <Select value={typo.fontBody} onValueChange={(v) => setTypo({ fontBody: v as FontKey })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{FONT_KEYS.map((k) => <SelectItem key={k} value={k}>{FONT_LABELS[k]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Osnovna pisava: {typo.baseFontSize}px</Label>
          <input
            type="range"
            min={13}
            max={20}
            value={typo.baseFontSize}
            onChange={(e) => setTypo({ baseFontSize: Number(e.target.value) })}
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Debelina navadnega besedila</Label>
          <Select value={typo.fontWeight} onValueChange={(v) => setTypo({ fontWeight: v as never })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Navadna</SelectItem>
              <SelectItem value="medium">Srednja</SelectItem>
              <SelectItem value="semibold">Polkrepka</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
          {warnings.map((w) => <div key={w}>• {w}</div>)}
        </div>
      )}
      {errors.length > 0 && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-2 text-xs text-destructive">
          {errors.map((w) => <div key={w}>• {w}</div>)}
        </div>
      )}

      <Button size="sm" onClick={save} disabled={saving}>
        {saving ? "Shranjevanje…" : "Shrani barve in pisave"}
      </Button>
    </div>
  )
}