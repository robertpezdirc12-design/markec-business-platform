"use client"

// ============================================================
// F5.3.1 — VIZUALNI UREJEVALNIK SPLEtNE STRANI
//
// Podjetnik vidi svojo stran (iframe = ISTI /s/{slug}/preview?edit=1
// renderer kot javna stran) in z uporabo selekcije sekcij + stranskega
// panela uredi vsebino. Draft se varnostno shranjuje prek
// `updateSiteContent` (z optimistično zaščito contentVersion), objava in
// povratek uporabita obstoječi sistem (publishSite / revert).
// Komunikacija z iframe prek postMessage je origin-checked (same-origin).
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  SmartphoneIcon,
  TabletIcon,
  DesktopIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PlusIcon,
  SaveIcon,
  RocketIcon,
  SettingsIcon,
  UploadIcon,
} from "@/components/icons"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n/provider"
import {
  getOrgBranding,
  updateSiteContent,
  revertSiteContentToPublished,
} from "@/app/actions/site-content"
import { publishSite } from "@/app/actions/publication"
import type { PublicationStatus } from "@/app/actions/publication"
import { PublicationHistoryDialog } from "@/components/site-editor/publication-history-dialog"
import { ShareQrCard } from "@/components/site-editor/share-qr-card"
import { uploadImage } from "@/lib/upload-client"
import {
  normalizeSections,
  sanitizeCustomSections,
  type SiteContent,
  type SectionEntry,
} from "@/lib/site-content"
import {
  EDITOR_SOURCE,
  isPreviewMessage,
  isTrustedOrigin,
  type EditorToPreviewMessage,
} from "@/lib/site-editor-bridge"
import type { SiteTheme } from "@/lib/site-design"
import { ThemePanel } from "@/components/site-editor/theme-panel"
import { NavigationPanel } from "@/components/site-editor/navigation-panel"
import { TemplatesPanel } from "@/components/site-editor/templates-panel"

type DeviceId = "390" | "768" | "1440"

const DEVICES: { id: DeviceId; icon: typeof SmartphoneIcon }[] = [
  { id: "390", icon: SmartphoneIcon },
  { id: "768", icon: TabletIcon },
  { id: "1440", icon: DesktopIcon },
]
const DEVICE_WIDTH: Record<DeviceId, number> = { "390": 390, "768": 768, "1440": 1440 }

/** True, ko se dva `SectionEntry` nanašata na ISTO sekcijo (builtin po ključu,
 *  lastna po `id`). Type-safe dostop do `id`, ki obstaja le na custom vnosih. */
function sameSection(a: SectionEntry, b: SectionEntry): boolean {
  if (a.key !== b.key) return false
  if (a.key === "custom" && b.key === "custom") return a.id === b.id
  return true
}

function sectionLabel(key: string): string {
  const k = key.startsWith("custom-") ? "custom" : key
  const map: Record<string, string> = {
    hero: "Naslovnica (hero)",
    features: "Prednosti",
    services: "Storitve",
    about: "O nas",
    team: "Ekipa",
    reviews: "Ocene",
    shop: "Izdelki",
    cta: "Poziv k dejanju",
    custom: "Lastna sekcija",
    openingHours: "Odpiralni čas",
  }
  return map[k] ?? k
}

export function SiteVisualEditor() {
  const router = useRouter()
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<{ slug: string | null; name: string } | null>(null)
  const [content, setContent] = useState<SiteContent | null>(null)
  const [publication, setPublication] = useState<PublicationStatus | null>(null)
  const [device, setDevice] = useState<DeviceId>("1440")
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  // Točka 6 — dialog zgodovine objav.
  const [historyOpen, setHistoryOpen] = useState(false)
  // F5.3.1: drag-and-drop razvrščanje sekcij — indeks trenutno vlečene vrstice.
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  // F5.3.2 — teme, capability imena in aktivni način urejevalnika.
  const [theme, setTheme] = useState<SiteTheme | null>(null)
  const [capabilities, setCapabilities] = useState<string[]>([])
  type EditorMode = "sections" | "colors" | "nav" | "templates"
  const [mode, setMode] = useState<EditorMode>("sections")
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // F5 — auto-save (točka 5): osnutek se debounce-a in shrani samodejno.
  const savingRef = useRef(false)
  const dirtyRef = useRef(false)
  const firstLoadedRef = useRef(false)
  const lastSavedRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    const res = await getOrgBranding()
    if (!res.success || !("org" in res) || !res.org || !res.siteContent || !res.publication) {
      setLoading(false)
      toast.error("Nalaganje vsebine ni uspelo.")
      return
    }
    setOrg({ slug: res.org.slug, name: res.org.name })
    setContent(res.siteContent)
    setPublication(res.publication)
    setTheme((res as { theme?: SiteTheme | null }).theme ?? null)
    setCapabilities((res as { capabilities?: string[] }).capabilities ?? [])
    setLoading(false)
    setSelected(null)
    // Auto-save bazen: naloženo vsebino vzemi kot izhodišče "že shranjeno".
    firstLoadedRef.current = true
    dirtyRef.current = false
    lastSavedRef.current = JSON.stringify(res.siteContent)
  }, [])

  // Naloži ob priklopu — klic gre skozi `await`, zato ni setState v telesu
  // efekta; zastavica prepreči zapis po odklopu komponente.
  useEffect(() => {
    let alive = true
    void (async () => {
      await Promise.resolve()
      if (alive) await load()
    })()
    return () => {
      alive = false
    }
  }, [load])

  // Pošlji trenutni osnutek iframe predogledu → takojšnja posodobitev.
  const pushPreview = useCallback(
    (c: SiteContent) => {
      iframeRef.current?.contentWindow?.postMessage(
        { source: EDITOR_SOURCE, type: "preview-content", contentVersion: publication?.contentVersion ?? 1, content: c } satisfies EditorToPreviewMessage,
        window.location.origin
      )
    },
    [publication?.contentVersion]
  )

  // Pridobljeno → objavi? Ne. Pošlji ob prvem mountu (ko iframe prihaja).
  useEffect(() => {
    if (content) pushPreview(content)
  }, [content, pushPreview])

  // F5 — auto-save osnutka (točka 5): ob vsaki realni spremembi vsebine
  // (ko se osnutek razlikuje od zadnjega shranjenega) debounce-a 900 ms in
  // shrani v osnutek. Javna stran se ne dotakne (to je vedno eksplicitna
  // OBJAVA). Preskoči prvi nalaganje, shranjevanje med tekom in vsebino,
  // ki je enaka zadnje shranjeni (npr. ročni Save jo je že potegnil).
  useEffect(() => {
    if (!content || !firstLoadedRef.current) return
    const serialized = JSON.stringify(content)
    if (serialized === lastSavedRef.current) return
    dirtyRef.current = true
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void handleSave(false)
    }, 900)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  // Predogled → "izbrana sekcija" (origin + tip preverjeni).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isTrustedOrigin(event.origin)) return
      if (!isPreviewMessage(event.data)) return
      setSelected(event.data.sectionKey)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  const patchSection = (patch: Partial<SiteContent>) => {
    if (!content) return
    const next: SiteContent = { ...content, ...patch, sections: content.sections }
    setContent(next)
  }

  async function handleSave(showToast = true) {
    if (!content) return
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    const payload: SiteContent = {
      ...content,
      sections: normalizeSections(content.sections) ?? content.sections,
      customSections: sanitizeCustomSections(content.customSections) ?? undefined,
    }
    try {
      const res = await updateSiteContent(payload, {
        expectedContentVersion: publication?.contentVersion,
      })
      if ("error" in res && typeof res.error === "string") {
        // STALE → uporabnik naj naloži svežo vsebino. Pri auto-save po
        // zgoli za nazaj tih reload; pri ročnem Save pokažemo opozorilo.
        if (showToast) toast.error(res.error)
        await load()
        return
      }
      // Ažuriraj "izhodiščno shranjeno" vsebino, da naslednji auto-save
      // ne shrani znova istega (brez diverzije).
      lastSavedRef.current = JSON.stringify(payload)
      dirtyRef.current = false
      if (showToast) toast.success("Osnutek shranjen.")
      await load()
      router.refresh()
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (publishing) return
    setPublishing(true)
    const res = await publishSite()
    setPublishing(false)
    if (res.success) {
      toast.success("Spletna stran objavljena.")
      await load()
      router.refresh()
    } else {
      toast.error(res.errors.join(" "))
    }
  }

  const handleRevert = async () => {
    const res = await revertSiteContentToPublished()
    if ("error" in res && typeof res.error === "string") {
      toast.error(res.error)
      return
    }
    toast.success("Vsebina povrnjena na objavljeno.")
    await load()
    router.refresh()
  }

  async function handleImageForSection(sectionKey: string, file: File) {
    try {
      const url = await uploadImage(file, "hero") // type: hero/about/cta — shared
      setContent((c) => (c ? { ...c } : c))
      applyImageField(sectionKey, url)
      toast.success("Slika naložena.")
    } catch {
      toast.error("Nalaganje slike ni uspelo.")
    }
  }

  /** F5.3.1: slika v sekciji (hero/about/cta/custom). */
  function applyImageField(sectionKey: string, url: string) {
    if (!content) return
    const base = keyOf(sectionKey)
    if (base === "custom") {
      const id = sectionKey.slice("custom-".length)
      const next = {
        ...content,
        customSections: {
                ...(content.customSections ?? {}),
                [id]: { ...(content.customSections?.[id] ?? { title: "", paragraphs: [] }), imageUrl: url },
              },
      }
      setContent(next)
      return
    }
    if (base === "hero") patchSection({ hero: { ...content.hero, imageUrl: url } })
    else if (base === "about") patchSection({ about: { ...content.about, imageUrl: url } })
  }

  function keyOf(sectionKey: string): string {
    return sectionKey.startsWith("custom-") ? "custom" : sectionKey
  }

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------
  if (loading || !content || !org) {
    return <div className="py-16 text-center text-muted-foreground">Nalaganje urejevalnika …</div>
  }

  const width = DEVICE_WIDTH[device]
  const sections = normalizeSections(content.sections) ?? content.sections

  return (
    <div className="space-y-4">
      {/* Top toolbar: device + save/publish */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 shadow-sm">
        <div className="flex items-center gap-1 rounded-md border p-1">
          {DEVICES.map((d) => {
            const Icon = d.icon
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDevice(d.id)}
                className={
                  device === d.id
                    ? "rounded-md bg-primary text-primary-foreground px-2.5 py-1.5 text-xs font-medium"
                    : "rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                }
              >
                <Icon size={15} className="mx-auto" />
                <span className="mt-0.5 block">{d.id}</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {publication?.hasUnpublishedChanges
              ? "Neshranjene spremembe osnutka"
              : "Osnutek = objavljeno"}
          </span>
          <Button variant="outline" size="sm" onClick={handleRevert} disabled={!publication?.hasUnpublishedChanges}>
            Povrni na objavljeno
          </Button>
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
            Zgodovina objav
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleSave()} disabled={saving} title={t.settings?.branding?.saveContent ?? "Shrani osnutek"}>
            <SaveIcon size={16} className="mr-1" /> {saving ? "Shranjevanje…" : "Shrani osnutek"}
          </Button>
          <Button size="sm" variant="secondary" onClick={handlePublish} disabled={publishing}>
            <RocketIcon size={16} className="mr-1" /> {publishing ? "Objavljanje…" : "Objavi"}
          </Button>
        </div>
      </div>

      {/* Točka 6 — QR koda + povezava za deljenje (po objavi). */}
      <ShareQrCard />

      {/* F5.3.2 — urejevalni način (Sekcije / Barve in pisave / Navigacija / Predloge) */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/20 px-2 py-1.5">
        {(
          [
            ["sections", "Sekcije"],
            ["colors", "Barve in pisave"],
            ["nav", "Navigacija"],
            ["templates", "Predloge"],
          ] as [EditorMode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m)
              if (m === "sections") setSelected(null)
            }}
            className={
              "rounded-md px-3 py-1.5 text-xs font-medium " +
              (mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* 1. Left: section list */}
        <aside className="w-full shrink-0 rounded-lg border bg-muted/20 p-3 lg:w-60">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Sekcije</h3>
            <Button size="sm" variant="ghost" onClick={() => setSelected("paleta")}>
              <PlusIcon size={14} className="mr-1" /> Dodaj
            </Button>
          </div>
          <ul className="space-y-1">
            {sections.map((meta, idx) => {
              const id = meta.key === "custom" ? `custom-${meta.id}` : meta.key
              const active = selected === id
              const dragging = dragIndex === idx
              return (
                <li
                  key={id}
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(idx)
                    e.dataTransfer.effectAllowed = "move"
                    e.dataTransfer.setData("text/plain", id)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "move"
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault()
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragIndex !== null) reorder(dragIndex, idx)
                    setDragIndex(null)
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className={dragging ? "opacity-40" : ""}
                >
                  <div
                    title="Povleci za razvrščanje"
                    className={
                      "flex items-center justify-between gap-1 rounded-md border px-2 py-1.5 text-sm " +
                      (active ? "border-primary bg-primary/10 font-medium" : "border-transparent hover:bg-accent")
                    }
                  >
                    <button type="button" className="flex-1 text-left" onClick={() => setSelected(id)}>
                      {sectionLabel(id)}
                    </button>
                    <div className="flex items-center gap-0.5">
                      <button type="button" className="rounded p-1 text-muted-foreground hover:bg-accent" onClick={() => move(meta, -1)} title="Gor">
                        <ChevronUpIcon size={14} />
                      </button>
                      <button type="button" className="rounded p-1 text-muted-foreground hover:bg-accent" onClick={() => move(meta, 1)} title="Dol">
                        <ChevronDownIcon size={14} />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:bg-accent"
                        onClick={() => toggleVisibility(meta)}
                        title="Vidnost"
                      >
                        {meta.visible ? "🙈" : "👁"}
                      </button>
                      {meta.key === "custom" && (
                        <button type="button" className="rounded p-1 text-destructive hover:bg-accent" onClick={() => remove(meta)} title="Odstrani">
                          <TrashIcon size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* 2. Center: iframe preview (real renderer) scaled per device */}
        <div className="flex-1 overflow-hidden rounded-lg border bg-white">
          {org.slug ? (
            <div className="relative mx-auto" style={{ maxWidth: `${width}px` }}>
              <iframe
                ref={iframeRef}
                src={`/s/${org.slug}/preview?edit=1`}
                className="h-[78vh] w-full"
                style={{ width }}
                title="Predogled spletne strani"
              />
            </div>
          ) : (
            <p className="p-8 text-center text-muted-foreground">Predogled ni na voljo.</p>
          )}
        </div>

        {/* 3. Right: inspector panel */}
        <aside className="w-full shrink-0 space-y-3 rounded-lg border bg-muted/10 p-3 lg:w-80">
          {mode === "colors" ? (
            <ThemePanel
              initial={theme}
              onSaved={() => {
                load()
                router.refresh()
              }}
            />
          ) : mode === "nav" ? (
            <NavigationPanel
              content={content}
              capabilitiesEnabled={capabilities}
              onChange={(c) => {
                setContent(c)
                pushPreview(c)
              }}
            />
          ) : mode === "templates" ? (
            <TemplatesPanel
              vertical={null}
              capabilitiesEnabled={capabilities}
              currentTemplateId={content?._templateId}
            />
          ) : selected === "paleta" ? (
            <AddSectionPanel onAdd={addSection} onClose={() => setSelected(null)} />
          ) : selected ? (
            <SectionInspector
              key={selected}
              sectionKey={selected}
              content={content}
              onChange={(c) => {
                setContent(c)
                pushPreview(c)
              }}
              onImage={(file) => handleImageForSection(selected, file)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Izberite sekcijo v predogledu (kliknite ✎) ali v seznamu za urejanje.
            </p>
          )}
        </aside>
      </div>

      {/* Točka 6 — zgodovina objav + vrnitev različice */}
      <PublicationHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </div>
  )

  // ---------------------------------------------------------
  // Sekcije — pomožne akcije (v closure nad content/sections)
  // ---------------------------------------------------------
  function move(meta: SectionEntry, dir: -1 | 1) {
    if (!content) return
    const list = [...sections]
    const i = list.findIndex((s) => sameSection(s, meta))
    if (i === -1) return
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    setContent({ ...content, sections: list })
  }

  /** F5.3.1: drag-and-drop — prestavi sekcijo z `fromIdx` na `toIdx`. */
  function reorder(fromIdx: number, toIdx: number) {
    if (!content || fromIdx === toIdx) return
    const list = [...sections]
    const [moved] = list.splice(fromIdx, 1)
    list.splice(toIdx, 0, moved)
    setContent({ ...content, sections: list })
  }

  function toggleVisibility(meta: SectionEntry) {
    if (!content) return
    const list = sections.map((s) => (sameSection(s, meta) ? { ...s, visible: !s.visible } : s))
    setContent({ ...content, sections: list })
  }

  function remove(meta: SectionEntry) {
    if (!content) return
    if (meta.key !== "custom") return
    const id = meta.id
    const list = sections.filter((s) => !(s.key === "custom" && s.id === id))
    const customSections = { ...(content.customSections ?? {}) }
    delete customSections[id]
    setContent({ ...content, sections: list, customSections })
  }

  function addSection(kind: "builtin" | "custom") {
    if (!content) return
    if (kind === "custom") {
      const id = `c${Date.now().toString(36)}`
      const list = [...sections, { key: "custom" as const, visible: true, id, label: "Nova sekcija" }]
      const customSections = {
        ...(content.customSections ?? {}),
        [id]: { title: "Nova sekcija", paragraphs: [""] },
      }
      setContent({ ...content, sections: list, customSections })
      setSelected(`custom-${id}`)
      return
    }
    // builtin already-present → just reveal (no duplicates).
    toast.info("Vse privzete sekcije že obstajajo. Uredite jih v levem seznamu.")
  }
}

// ---------------------------------------------------------------
// Add-section panel (uddaja "lastna" sekcija)
// ---------------------------------------------------------------
function AddSectionPanel({ onAdd, onClose }: { onAdd: (kind: "builtin" | "custom") => void; onClose: () => void }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Dodaj sekcijo</h4>
      <p className="text-xs text-muted-foreground">Lastna sekcija (naslov + besedilo + opcijska slika/gumb).</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onAdd("custom")}>
          <PlusIcon size={14} className="mr-1" /> Lastna sekcija
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          Prekliči
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Section Inspector — za izbrano sekcijo (splošna polja)
// ---------------------------------------------------------------
function SectionInspector({
  sectionKey,
  content,
  onChange,
  onImage,
}: {
  sectionKey: string
  content: SiteContent
  onChange: (c: SiteContent) => void
  onImage: (file: File) => void
}) {
  const base = sectionKey.startsWith("custom-") ? "custom" : sectionKey
  const image = content[base as "hero"] ? (content[base as "hero"] as { imageUrl?: string | null }).imageUrl : null
  const customId = base === "custom" ? sectionKey.slice("custom-".length) : null

  const up = (patch: Partial<SiteContent>) => onChange({ ...content, ...patch })

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Uredi: {sectionLabel(sectionKey)}</h4>

      {base === "hero" && (
        <>
          <Field label="Naslov">
            <Input value={content.hero.title} onChange={(e) => up({ hero: { ...content.hero, title: e.target.value } })} />
          </Field>
          <Field label="Podnaslov">
            <Textarea rows={2} value={content.hero.subtitle ?? ""} onChange={(e) => up({ hero: { ...content.hero, subtitle: e.target.value } })} />
          </Field>
          <Field label="Glavni gumb">
            <Input value={content.hero.primaryCta.label} onChange={(e) => up({ hero: { ...content.hero, primaryCta: { label: e.target.value, href: content.hero.primaryCta.href } } })} />
          </Field>
        </>
      )}

      {base === "about" && (
        <>
          <Field label="Naslov">
            <Input value={content.about.title} onChange={(e) => up({ about: { ...content.about, title: e.target.value } })} />
          </Field>
          <Field label="Opis">
            <Textarea rows={4} value={content.about.paragraphs.join("\n") || ""} onChange={(e) => up({ about: { ...content.about, paragraphs: e.target.value.split("\n") } })} />
          </Field>
        </>
      )}

      {base === "features" && (
        <>
          <Field label="Naslov">
            <Input value={content.features.title} onChange={(e) => up({ features: { ...content.features, title: e.target.value } })} />
          </Field>
          <Field label="Podnaslov">
            <Input value={content.features.subtitle ?? ""} onChange={(e) => up({ features: { ...content.features, subtitle: e.target.value } })} />
          </Field>
        </>
      )}

      {base === "cta" && (
        <>
          <Field label="Naslov">
            <Input value={content.cta.title} onChange={(e) => up({ cta: { ...content.cta, title: e.target.value } })} />
          </Field>
          <Field label="Gumb">
            <Input value={content.cta.buttonLabel} onChange={(e) => up({ cta: { ...content.cta, buttonLabel: e.target.value } })} />
          </Field>
        </>
      )}

      {base === "custom" && customId && (
        <>
          <Field label="Naslov">
            <Input
              value={content.customSections?.[customId]?.title ?? ""}
              onChange={(e) =>
                onChange({
                  ...content,
                  customSections: { ...content.customSections, [customId]: { ...(content.customSections?.[customId] ?? { title: "", paragraphs: [] }), title: e.target.value } },
                })
              }
            />
          </Field>
          <Field label="Besedilo">
            <Textarea
              rows={4}
              value={(content.customSections?.[customId]?.paragraphs ?? []).join("\n")}
              onChange={(e) =>
                onChange({
                  ...content,
                  customSections: { ...content.customSections, [customId]: { ...(content.customSections?.[customId] ?? { title: "", paragraphs: [] }), paragraphs: e.target.value.split("\n") } },
                })
              }
            />
          </Field>
        </>
      )}

      {/* 2D-9: sekcije, katerih vsebinske glave (naslov/podnaslov) urejamod v
          SiteContent brez poseganja v poslovne podatke (storitve/izdelki/ekipa/
          ocene so v lastnih DB modulih — tukaj urejamo le sekcijski ovoj). */}
      {base === "services" && (
        <>
          <Field label="Naslov sekcije (Storitve)">
            <Input value={content.services?.title ?? ""} onChange={(e) => up({ services: { ...content.services, title: e.target.value } })} />
          </Field>
          <Button size="sm" variant="outline" asChild className="w-full">
            <Link href="/dashboard/services"><SettingsIcon size={14} className="mr-1" /> Upravljaj storitve</Link>
          </Button>
        </>
      )}
      {base === "team" && (
        <>
          <Field label="Naslov sekcije (Ekipa)">
            <Input value={content.team?.title ?? ""} onChange={(e) => up({ team: { ...content.team, title: e.target.value } })} />
          </Field>
          <Button size="sm" variant="outline" asChild className="w-full">
            <Link href="/dashboard/staff"><SettingsIcon size={14} className="mr-1" /> Upravljaj ekipo</Link>
          </Button>
        </>
      )}
      {base === "shop" && (
        <>
          <Field label="Naslov sekcije (Izdelki)">
            <Input value={content.shop?.title ?? ""} onChange={(e) => up({ shop: { ...content.shop, title: e.target.value } })} />
          </Field>
          <Button size="sm" variant="outline" asChild className="w-full">
            <Link href="/dashboard/products"><SettingsIcon size={14} className="mr-1" /> Upravljaj izdelke</Link>
          </Button>
        </>
      )}
      {base === "reviews" && (
        <>
          <Field label="Naslov sekcije (Ocene)">
            <Input value={content.reviews?.title ?? ""} onChange={(e) => up({ reviews: { ...(content.reviews ?? {}), title: e.target.value } })} />
          </Field>
          <Field label="Podnaslov (Ocene)">
            <Input value={content.reviews?.subtitle ?? ""} onChange={(e) => up({ reviews: { ...(content.reviews ?? {}), subtitle: e.target.value } })} />
          </Field>
          <p className="text-muted-foreground text-xs">Ocene ustvarijo stranke po opravljeni storitvi/naročilu. Javno se izpišejo same — brez lažnih mnenj.</p>
        </>
      )}

      {/* Image for hero/about/custom */}
      {(base === "hero" || base === "about" || base === "custom") && (
        <div className="space-y-1.5">
          <Label>Slika</Label>
          <div className="flex items-center gap-2">
            <Input readOnly value={image ?? ""} placeholder="Izberi sliko" />
            <Button size="sm" variant="outline" asChild>
              <label className="cursor-pointer">
                <UploadIcon size={14} className="mr-1" />
                Naloži
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])} />
              </label>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}