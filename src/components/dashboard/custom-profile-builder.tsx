"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Button,
} from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Switch,
} from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Plus,
  Trash2,
  Save,
  X,
  Edit,
  Layout,
  Building2,
  BarChart3,
  Calendar,
  FileText,
  Settings,
  ShieldAlert,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/provider"
import {
  getOrgCustomProfile,
  saveOrgCustomProfile,
  removeOrgCustomProfile,
  type CustomProfileData,
} from "@/app/actions/custom-profile"

type CapabilityState = "required" | "optional" | "disabled"

const CAPABILITY_KEYS: { key: string; label: string; desc: string }[] = [
  { key: "appointments", label: "Termini in rezervacije", desc: "Pregledki, koledar, termini" },
  { key: "workOrders", label: "Delovna naročila", desc: "Proizvodni in servisni nalogi" },
  { key: "shop", label: "Spletna trgovina", desc: "Izdelki, košarica, naročila" },
  { key: "services", label: "Katalog storitev", desc: "Storitve, cene, trajanje" },
  { key: "inventory", label: "Zaloge", desc: "Sledenje zalog, sciroko" },
  { key: "customers", label: "Stranke", desc: "Stranksa baza, zgodovina" },
  { key: "staff", label: "Zaposleni", desc: "Osebje, urniki, smene" },
  { key: "analytics", label: "Analitika", desc: "Poročila, statistika" },
  { key: "reviews", label: "Ocene strank", desc: "Ocene in mnenja" },
  { key: "forms", label: "Dinamični obrazci", desc: "Vprašalniki, obrazci" },
  { key: "workflows", label: "Poslovni procesi", desc: "Faze, SLA, odobritve" },
  { key: "documents", label: "Dokumenti", desc: "Ponudbe, računi" },
  { key: "delivery", label: "Dostava", desc: "Pošiljke, dostave" },
  { key: "walkIn", label: "Walk-in vrsta", desc: "Prijava brez računa" },
]

const WIDGET_KEYS: { key: string; label: string }[] = [
  { key: "todayAppointments", label: "Današnji termini" },
  { key: "revenue", label: "Prihodek (mesec)" },
  { key: "customers", label: "Nove stranke" },
  { key: "topServices", label: "Priljubljene storitve" },
  { key: "recentOrders", label: "Nedavna naročila" },
  { key: "lowStock", label: "Nizke zaloge" },
  { key: "activeOrders", label: "Aktivna naročila" },
  { key: "deadlines", label: "Roki v 7 dneh" },
  { key: "pendingApprovals", label: "Čaka potrditev" },
  { key: "readyForDelivery", label: "Za predajo/dostavo" },
  { key: "projects", label: "Projekti" },
]

const CTA_MODES: { key: "booking" | "inquiry" | "order" | "quote"; label: string }[] = [
  { key: "booking", label: "Rezerviranje (termini)" },
  { key: "inquiry", label: "Povpraševanje (kontakt)" },
  { key: "order", label: "Naročanje (izdelki)" },
  { key: "quote", label: "Ponudba (cena po meri)" },
]

const PALETTE_KEYS: { key: string; label: string }[] = [
  { key: "rose", label: "Rožnata & Zlata" },
  { key: "amber", label: "Jantar & Med" },
  { key: "charcoal", label: "Antracit & Zlata" },
  { key: "violet", label: "Vijolična & Pastel" },
  { key: "emerald", label: "Smaragdna" },
  { key: "teal", label: "Modrozelena & Mint" },
  { key: "coral", label: "Koralna" },
  { key: "burgundy", label: "Bordó & Terakota" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyCustomProfile(): CustomProfileData {
  return {
    id: "",
    label: "",
    description: "",
    palette: "coral",
    schemaType: "LocalBusiness",
    capabilities: {},
    ctaMode: "inquiry",
    forms: [],
    workflows: [],
    dashboardWidgets: [],
  }
}

function initialCapabilityState(key: string): CapabilityState {
  // Default: optional for most, required for customers+analytics
  if (key === "customers" || key === "analytics") return "required"
  return "optional"
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CustomProfileBuilderProps {
  orgId: string
}

export function CustomProfileBuilder({ orgId }: CustomProfileBuilderProps) {
  const { t, locale } = useI18n()
  const [pending, startTransition] = useTransition()
  const [profile, setProfile] = useState<CustomProfileData | null>(null)
  const [editing, setEditing] = useState(false)
  const [activeSection, setActiveSection] = useState<"basic" | "capabilities" | "forms" | "workflows" | "widgets" | "cta">("basic")

  // Draft state (applied on Save)
  const [draft, setDraft] = useState<CustomProfileData>(emptyCustomProfile())
  const [dirty, setDirty] = useState(false)

  // Load existing custom profile
  useEffect(() => {
    let cancelled = false
    getOrgCustomProfile()
      .then((res) => {
        if (cancelled) return
        if (res.ok) {
          setProfile(res.profile ?? null)
          setDraft(res.profile ?? emptyCustomProfile())
          setDirty(false)
        }
      })
      .catch(() => {
        // silent
      })
    return () => { cancelled = true }
  }, [])

  const hasProfile = profile !== null

  const markDirty = useCallback(() => setDirty(true), [])

  const setField = useCallback((key: string, value: any) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setDirty(true)
  }, [])

  // --- Capability toggle ---
  const toggleCapability = useCallback((key: string, state: CapabilityState) => {
    setDraft((d) => ({
      ...d,
      capabilities: { ...d.capabilities, [key]: state },
    }))
    setDirty(true)
  }, [])

  // --- Forms ---
  const addForm = useCallback(() => {
    const newKey = `form-${Date.now()}`
    setDraft((d) => ({
      ...d,
      forms: [
        ...d.forms,
        {
          key: newKey,
          name: "Nov obrazec",
          description: "",
          fields: [
            { key: "ime", label: "Ime", type: "text", required: true },
          ],
        },
      ],
    }))
    setDirty(true)
  }, [])

  const removeForm = useCallback((index: number) => {
    setDraft((d) => {
      const next = [...d.forms]
      next.splice(index, 1)
      return { ...d, forms: next }
    })
    setDirty(true)
  }, [])

  const updateForm = useCallback((index: number, updates: Partial<CustomProfileData["forms"][number]>) => {
    setDraft((d) => {
      const next = [...d.forms]
      next[index] = { ...next[index], ...updates }
      return { ...d, forms: next }
    })
    setDirty(true)
  }, [])

  const addField = useCallback((formIndex: number) => {
    setDraft((d) => {
      const next = [...d.forms]
      const form = { ...next[formIndex] }
      const newKey = `field-${Date.now()}`
      form.fields = [
        ...form.fields,
        { key: newKey, label: "Novo polje", type: "text", required: false },
      ]
      next[formIndex] = form
      return { ...d, forms: next }
    })
    setDirty(true)
  }, [])

  const removeField = useCallback((formIndex: number, fieldIndex: number) => {
    setDraft((d) => {
      const next = [...d.forms]
      const form = { ...next[formIndex] }
      form.fields.splice(fieldIndex, 1)
      next[formIndex] = form
      return { ...d, forms: next }
    })
    setDirty(true)
  }, [])

  const updateField = useCallback((formIndex: number, fieldIndex: number, updates: any) => {
    setDraft((d) => {
      const next = [...d.forms]
      const form = { ...next[formIndex] }
      form.fields = [
        ...form.fields.map((f, i) => i === fieldIndex ? { ...f, ...updates } : f),
      ]
      next[formIndex] = form
      return { ...d, forms: next }
    })
    setDirty(true)
  }, [])

  // --- Workflows ---
  const addWorkflow = useCallback(() => {
    const newKey = `wf-${Date.now()}`
    setDraft((d) => ({
      ...d,
      workflows: [
        ...d.workflows,
        {
          key: newKey,
          name: "Nov proces",
          entity: "order",
          stages: [
            { key: "start", name: "Začetek", description: "", order: 0, isFinal: false },
            { key: "done", name: "Zaključeno", description: "", order: 1, isFinal: true },
          ],
        },
      ],
    }))
    setDirty(true)
  }, [])

  const removeWorkflow = useCallback((index: number) => {
    setDraft((d) => {
      const next = [...d.workflows]
      next.splice(index, 1)
      return { ...d, workflows: next }
    })
    setDirty(true)
  }, [])

  const updateWorkflow = useCallback((index: number, updates: Partial<CustomProfileData["workflows"][number]>) => {
    setDraft((d) => {
      const next = [...d.workflows]
      next[index] = { ...next[index], ...updates }
      return { ...d, workflows: next }
    })
    setDirty(true)
  }, [])

  const addStage = useCallback((workflowIndex: number) => {
    setDraft((d) => {
      const next = [...d.workflows]
      const wf = { ...next[workflowIndex] }
      const maxOrder = Math.max(0, ...wf.stages.map((s) => s.order ?? 0))
      wf.stages = [
        ...wf.stages,
        { key: `stage-${Date.now()}`, name: "Nova faza", description: "", order: maxOrder + 1, isFinal: false },
      ]
      next[workflowIndex] = wf
      return { ...d, workflows: next }
    })
    setDirty(true)
  }, [])

  const removeStage = useCallback((workflowIndex: number, stageIndex: number) => {
    setDraft((d) => {
      const next = [...d.workflows]
      const wf = { ...next[workflowIndex] }
      wf.stages.splice(stageIndex, 1)
      next[workflowIndex] = wf
      return { ...d, workflows: next }
    })
    setDirty(true)
  }, [])

  // --- Widgets ---
  const toggleWidget = useCallback((key: string) => {
    setDraft((d) => {
      const widgets = d.dashboardWidgets.includes(key)
        ? d.dashboardWidgets.filter((w) => w !== key)
        : [...d.dashboardWidgets, key]
      return { ...d, dashboardWidgets: widgets }
    })
    setDirty(true)
  }, [])

  // --- Save / Remove ---
  const handleSave = useCallback(async () => {
    if (!draft.label.trim() || !draft.id.trim()) {
      toast.error("Ime in identifikator profila sta obvezna.")
      return
    }
    if (!/^[a-z][a-z0-9-]*$/.test(draft.id)) {
      toast.error("Identifikator smet vsebovati samo male črke, številke in pomišljaje.")
      return
    }
    startTransition(async () => {
      const res = await saveOrgCustomProfile(draft)
      if (res.ok) {
        setProfile(res.profile ?? draft)
        setDirty(false)
        setEditing(false)
        toast.success("Profil je shranjen.")
      } else {
        toast.error(res.error ?? "Napaka pri shranjevanju.")
      }
    })
  }, [draft])

  const handleRemove = useCallback(async () => {
    if (!window.confirm("Izbrišite svoj lastni profil? Najdete se nazaj na profil iz registra.")) return
    startTransition(async () => {
      const res = await removeOrgCustomProfile()
      if (res.ok) {
        setProfile(null)
        setDraft(emptyCustomProfile())
        setDirty(false)
        setEditing(false)
        toast.success("Lastni profil je odstranjen.")
      } else {
        toast.error(res.error ?? "Napaka pri brisanju.")
      }
    })
  }, [])

  // --- Section labels ---
  const sectionLabels: Record<string, string> = {
    basic: "Osnovni podatki",
    capabilities: "Zmožnosti (moduli)",
    forms: "Obrazci",
    workflows: "Poslovni procesi",
    widgets: "Nadzorna plošča",
    cta: "Spletna stran (CTA)",
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Lastni profil dejavnosti</CardTitle>
            <CardDescription>
              Ustvarite svoj profil dejavnosti brez kode — izberite zmožnosti,
              obrazce, procese in vsebino strani. Profil velja samo za vaše podjetje.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasProfile ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Edit className="w-4 h-4" /> Uredi profil
              </Button>
            ) : (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Building2 className="w-4 h-4" /> Ustvarite profil
              </Button>
            )}
          </div>
        </CardHeader>
        {hasProfile && profile && (
          <CardContent className="pt-0">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Ime</p>
                <p className="font-medium">{profile.label}</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Identifikator</p>
                <p className="font-mono text-xs text-muted-foreground">{profile.id}</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase font-semibold">CTA načim</p>
                <span className="badge badge-outline">{profile.ctaMode}</span>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Zmožnosti</p>
                <p className="text-xs">{Object.keys(profile.capabilities).length}</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Obrazci</p>
                <p className="text-xs">{profile.forms.length}</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Procesi</p>
                <p className="text-xs">{profile.workflows.length}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Builder (only when editing or creating) */}
      {editing && (
        <div className="space-y-6">
          {/* Navigation */}
          <div className="flex flex-wrap gap-2 border-b border-border pb-4">
            {[
              { id: "basic", label: "Osnovno", icon: Building2 },
              { id: "capabilities", label: "Zmožnosti", icon: Layout },
              { id: "forms", label: "Obrazci", icon: FileText },
              { id: "workflows", label: "Procesi", icon: Settings },
              { id: "widgets", label: "Widgeti", icon: BarChart3 },
              { id: "cta", label: "Spletna stran", icon: Calendar },
            ].map((section) => (
              <Button
                key={section.id}
                variant={activeSection === section.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSection(section.id as "basic" | "capabilities" | "forms" | "workflows" | "widgets" | "cta")}
                className="flex items-center gap-2"
              >
                {section.icon && <section.icon className="w-4 h-4" />}
                {section.label}
              </Button>
            ))}
          </div>

          {/* Section content */}
          <Card>
            <CardHeader>
              <CardTitle>{sectionLabels[activeSection]}</CardTitle>
              <CardDescription>
                Urejanje profila: {draft.label || "(nesnama)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {activeSection === "basic" && (
                <BasicSection draft={draft} setField={setField} markDirty={markDirty} />
              )}
              {activeSection === "capabilities" && (
                <CapabilitiesSection draft={draft} toggleCapability={toggleCapability} markDirty={markDirty} />
              )}
              {activeSection === "forms" && (
                <FormsSection
                  draft={draft}
                  addForm={addForm}
                  removeForm={removeForm}
                  updateForm={updateForm}
                  addField={addField}
                  removeField={removeField}
                  updateField={updateField}
                  markDirty={markDirty}
                />
              )}
              {activeSection === "workflows" && (
                <WorkflowsSection
                  draft={draft}
                  addWorkflow={addWorkflow}
                  removeWorkflow={removeWorkflow}
                  updateWorkflow={updateWorkflow}
                  addStage={addStage}
                  removeStage={removeStage}
                  markDirty={markDirty}
                />
              )}
              {activeSection === "widgets" && (
                <WidgetsSection draft={draft} toggleWidget={toggleWidget} markDirty={markDirty} />
              )}
              {activeSection === "cta" && (
                <CtaSection draft={draft} setField={setField} markDirty={markDirty} />
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={() => setEditing(false)}>
              <X className="w-4 h-4" /> Prekliči
            </Button>
            {hasProfile && (
              <Button variant="destructive" onClick={handleRemove} disabled={pending}>
                <Trash2 className="w-4 h-4" /> Izbriši profil
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={pending || !dirty || !draft.label.trim() || !draft.id.trim()}
              className="ml-auto"
            >
              {pending ? (
                <>
                  <Save className="w-4 h-4 animate-spin" /> Shranjujem …
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Shrani profil
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// SECTION COMPONENTS
// ============================================================

function BasicSection({
  draft,
  setField,
  markDirty,
}: {
  draft: CustomProfileData
  setField: (key: string, value: any) => void
  markDirty: () => void
}) {
  const { locale } = useI18n()

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Identifikator profila</Label>
        <Input
          value={draft.id}
          onChange={(e) => setField("id", e.target.value)}
          placeholder="npr. moj-profil"
          maxLength={50}
        />
        <p className="text-xs text-muted-foreground">
          Male črke, številke in pomišljaji. Uporablja se v URL-ju in v kodi.
        </p>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Ime dejavnosti</Label>
        <Input
          value={draft.label}
          onChange={(e) => setField("label", e.target.value)}
          placeholder="npr. Moj atelje"
          maxLength={100}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Opis</Label>
        <Input
          value={draft.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="Kaj delate?"
          maxLength={200}
        />
      </div>
      <div className="space-y-2">
        <Label>Barvna paleta</Label>
        <div className="flex gap-2">
          {PALETTE_KEYS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-pressed={draft.palette === p.key}
              onClick={() => setField("palette", p.key)}
              className={cn(
                "h-10 w-10 rounded-full border transition-all",
                draft.palette === p.key
                  ? "ring-2 ring-primary ring-offset-1"
                  : "border-transparent hover:border-border/50"
              )}
              style={{ background: `linear-gradient(135deg, #000 50%, #d4af37 50%)` }}
            />
          ))}
        </div>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>schema.org tip</Label>
        <Input
          value={draft.schemaType}
          onChange={(e) => setField("schemaType", e.target.value)}
          placeholder="LocalBusiness"
          maxLength={100}
        />
        <p className="text-xs text-muted-foreground">
          Za SEO in strukturirane podatke (npr. LocalBusiness, Store, Restaurant).
        </p>
      </div>
    </div>
  )
}

function CapabilitiesSection({
  draft,
  toggleCapability,
  markDirty,
}: {
  draft: CustomProfileData
  toggleCapability: (key: string, state: CapabilityState) => void
  markDirty: () => void
}) {
  const { locale } = useI18n()

  const stateLabels: Record<CapabilityState, string> = {
    required: "Obvezno",
    optional: "Izbirno",
    disabled: "Onemogočeno",
  }

  const stateColors: Record<CapabilityState, string> = {
    required: "bg-emerald-500/10 text-emerald-700 border-emerald-500/40",
    optional: "bg-amber-500/10 text-amber-700 border-amber-500/40",
    disabled: "bg-muted/50 text-muted-foreground border-border",
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        "Obvezno" vedno deluje. "Izbirno" lahko vklopite/izklopite kasneje. "Onemogočeno" je popolnoma izključeno.
      </p>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {CAPABILITY_KEYS.map((cap) => {
          const current = draft.capabilities[cap.key] ?? initialCapabilityState(cap.key)
          const nextState: CapabilityState =
            current === "required" ? "optional" : current === "optional" ? "disabled" : "required"
          return (
            <div
              key={cap.key}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border p-3 transition-all cursor-pointer",
                stateColors[current],
                "hover:border-primary/50"
              )}
              onClick={() => toggleCapability(cap.key, nextState)}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background border border-border">
                {current === "required" && (
                  <span className="text-xs font-bold text-emerald-600">O</span>
                )}
                {current === "optional" && (
                  <span className="text-xs font-bold text-amber-600">I</span>
                )}
                {current === "disabled" && (
                  <span className="text-xs font-bold text-muted-foreground">X</span>
                )}
              </div>
              <span className="text-xs font-medium text-center">{cap.label}</span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">{cap.desc}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FormsSection({
  draft,
  addForm,
  removeForm,
  updateForm,
  addField,
  removeField,
  updateField,
  markDirty,
}: {
  draft: CustomProfileData
  addForm: () => void
  removeForm: (index: number) => void
  updateForm: (index: number, updates: any) => void
  addField: (formIndex: number) => void
  removeField: (formIndex: number, fieldIndex: number) => void
  updateField: (formIndex: number, fieldIndex: number, updates: any) => void
  markDirty: () => void
}) {
  const { locale } = useI18n()

  const fieldTypeLabels: Record<string, string> = {
    text: "Krato besedilo",
    textarea: "Dolgo besedilo",
    number: "Število",
    date: "Datum",
    select: "Izbira",
    checkbox: "Potrditveno polje",
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Dinamični obrazci</h3>
        <Button size="sm" onClick={addForm}>
          <Plus className="w-4 h-4" /> Dodaj obrazec
        </Button>
      </div>
      {draft.forms.length === 0 && (
        <p className="text-sm text-muted-foreground">Ni obrazcev. Dodajte svoj prvi.</p>
      )}
      {draft.forms.map((form, formIndex) => (
        <Card key={form.key} className="border p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Input
                value={form.name}
                onChange={(e) => updateForm(formIndex, { name: e.target.value })}
                placeholder="Ime obrazca"
                className="text-sm font-medium bg-transparent border-none focus:ring-0"
              />
              <Input
                value={form.description}
                onChange={(e) => updateForm(formIndex, { description: e.target.value })}
                placeholder="Opis"
                className="text-xs text-muted-foreground bg-transparent border-none focus:ring-0 w-64"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => removeForm(formIndex)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Polja</p>
            <div className="space-y-2">
              {form.fields.map((field, fieldIndex) => (
                <div
                  key={field.key}
                  className="flex items-center gap-2 p-2 rounded border border-border/50"
                >
                  <Input
                    value={field.key}
                    onChange={(e) => updateField(formIndex, fieldIndex, { key: e.target.value })}
                    placeholder="ključ"
                    className="text-xs font-mono bg-transparent border-none focus:ring-0 w-24"
                  />
                  <Input
                    value={field.label}
                    onChange={(e) => updateField(formIndex, fieldIndex, { label: e.target.value })}
                    placeholder="Oznaka"
                    className="text-xs bg-transparent border-none focus:ring-0 flex-1"
                  />
                  <Select
                    value={field.type}
                    onValueChange={(v) => updateField(formIndex, fieldIndex, { type: v })}
                  >
                    <SelectTrigger className="h-8 min-h-[auto]">
                      <SelectValue placeholder={fieldTypeLabels[field.type]} />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "text",
                        "textarea",
                        "number",
                        "date",
                        "select",
                        "checkbox",
                      ].map((t) => (
                        <SelectItem key={t} value={t}>
                          {fieldTypeLabels[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Checkbox
                    checked={field.required}
                    onCheckedChange={(v) => updateField(formIndex, fieldIndex, { required: v })}
                    className="w-4 h-4"
                  />
                  <Label className="text-xs text-muted-foreground">Obvezno</Label>
                  <Button variant="outline" size="sm" onClick={() => removeField(formIndex, fieldIndex)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addField(formIndex)}>
                <Plus className="w-3 h-3" /> Dodaj polje
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function WorkflowsSection({
  draft,
  addWorkflow,
  removeWorkflow,
  updateWorkflow,
  addStage,
  removeStage,
  markDirty,
}: {
  draft: CustomProfileData
  addWorkflow: () => void
  removeWorkflow: (index: number) => void
  updateWorkflow: (index: number, updates: any) => void
  addStage: (workflowIndex: number) => void
  removeStage: (workflowIndex: number, stageIndex: number) => void
  markDirty: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Poslovni procesi (workflows)</h3>
        <Button size="sm" onClick={addWorkflow}>
          <Plus className="w-4 h-4" /> Dodaj proces
        </Button>
      </div>
      {draft.workflows.length === 0 && (
        <p className="text-sm text-muted-foreground">Ni procesov. Dodajte svoj prvi.</p>
      )}
      {draft.workflows.map((wf, wfIndex) => (
        <Card key={wf.key} className="border p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Input
                value={wf.name}
                onChange={(e) => updateWorkflow(wfIndex, { name: e.target.value })}
                placeholder="Ime procesa"
                className="text-sm font-medium bg-transparent border-none focus:ring-0"
              />
              <Select
                value={wf.entity}
                onValueChange={(v) => updateWorkflow(wfIndex, { entity: v })}
              >
                <SelectTrigger className="h-8 min-h-[auto]">
                  <SelectValue placeholder={wf.entity} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="order">Naročilo</SelectItem>
                  <SelectItem value="appointment">Termin</SelectItem>
                  <SelectItem value="invoice">Račun</SelectItem>
                  <SelectItem value="document">Dokument</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => removeWorkflow(wfIndex)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Faze</p>
            <div className="space-y-2">
              {wf.stages.map((stage, stageIndex) => (
                <div
                  key={stage.key}
                  className="flex items-center gap-2 p-2 rounded border border-border/50"
                >
                  <Input
                    value={stage.key}
                    onChange={(e) => {
                      updateWorkflow(wfIndex, {
                        stages: wf.stages.map((s, i) =>
                          i === stageIndex ? { ...s, key: e.target.value } : s
                        ),
                      })
                    }}
                    placeholder="ključ"
                    className="text-xs font-mono bg-transparent border-none focus:ring-0 w-24"
                  />
                  <Input
                    value={stage.name}
                    onChange={(e) => {
                      updateWorkflow(wfIndex, {
                        stages: wf.stages.map((s, i) =>
                          i === stageIndex ? { ...s, name: e.target.value } : s
                        ),
                      })
                    }}
                    placeholder="Ime faze"
                    className="text-xs bg-transparent border-none focus:ring-0 flex-1"
                  />
                  <Input
                    type="number"
                    value={stage.order ?? 0}
                    onChange={(e) => {
                      updateWorkflow(wfIndex, {
                        stages: wf.stages.map((s, i) =>
                          i === stageIndex ? { ...s, order: parseInt(e.target.value) || 0 } : s
                        ),
                      })
                    }}
                    className="text-xs bg-transparent border-none focus:ring-0 w-12"
                  />
                  <Checkbox
                    checked={stage.isFinal}
                    onCheckedChange={(v) => {
                      updateWorkflow(wfIndex, {
                        stages: wf.stages.map((s, i) =>
                          i === stageIndex ? { ...s, isFinal: v } : s
                        ),
                      })
                    }}
                    className="w-4 h-4"
                  />
                  <Label className="text-xs text-muted-foreground">Končna</Label>
                  <Button variant="outline" size="sm" onClick={() => removeStage(wfIndex, stageIndex)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addStage(wfIndex)}>
                <Plus className="w-3 h-3" /> Dodaj fazo
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function WidgetsSection({
  draft,
  toggleWidget,
  markDirty,
}: {
  draft: CustomProfileData
  toggleWidget: (key: string) => void
  markDirty: () => void
}) {
  const { locale } = useI18n()

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Izberite katere ogledke naj se prikažejo na nadzorni plošči.
      </p>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {WIDGET_KEYS.map((w) => {
          const active = draft.dashboardWidgets.includes(w.key)
          return (
            <label
              key={w.key}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition-colors",
                active
                  ? "border-primary/50 bg-primary/5"
                  : "hover:bg-accent/50"
              )}
            >
              <Checkbox
                checked={active}
                onCheckedChange={() => toggleWidget(w.key)}
                aria-label={w.label}
              />
              {w.label}
            </label>
          )
        })}
      </div>
    </div>
  )
}

function CtaSection({
  draft,
  setField,
  markDirty,
}: {
  draft: CustomProfileData
  setField: (key: string, value: any) => void
  markDirty: () => void
}) {
  const { locale } = useI18n()

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Glavni klic k dejanju (CTA) na spletni strani</Label>
        <p className="text-xs text-muted-foreground">
          Kaj storitve obiskalec vidi kot primarno dejanje na vaši javni strani.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {CTA_MODES.map((mode) => {
          const active = draft.ctaMode === mode.key
          return (
            <button
              key={mode.key}
              type="button"
              role="radio"
              aria-pressed={active}
              onClick={() => setField("ctaMode", mode.key)}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 transition-all",
                active
                  ? "border-primary bg-primary/5"
                  : "border-transparent hover:border-border/50"
              )}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-background border border-border">
                {active ? <CheckCircleIcon /> : <CircleIcon />}
              </div>
              <div>
                <div className="text-sm font-medium">{mode.label}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Small inline icons for CTA radio
function CheckCircleIcon() {
  return (
    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}
function CircleIcon() {
  return (
    <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
    </svg>
  )
}
