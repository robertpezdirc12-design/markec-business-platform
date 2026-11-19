"use client"

// F5.4.1 — »MOJI MODULI« (enoten zaslon).
// Združuje ModulesV2Card + ModulesConfigurator v en pregled: podjetnik vidi
// obvezne / priporočene / razpoložljive / nedovoljene module z razlago,
// odvisnostmi in posledicami izklopa. Uporablja ISTO akcijo `setModuleState`
// (ni nov sistem shranjevanja — OrganizationModuleState ostaja edini vir).

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  getModuleOverview,
  setModuleState,
  enableModuleWithDependencies,
  type ModuleView,
} from "@/app/actions/modules"
import { useI18n } from "@/lib/i18n/provider"

const CATEGORY_LABEL: Record<ModuleView["category"], { sl: string; en: string }> = {
  required: { sl: "Obvezen", en: "Required" },
  recommended: { sl: "Priporočen", en: "Recommended" },
  available: { sl: "Razpoložljiv", en: "Available" },
  disabled: { sl: "Ni na voljo za tvojo dejavnost", en: "Not available for your activity" },
}

const CATEGORY_ORDER: ModuleView["category"][] = ["required", "recommended", "available", "disabled"]

export function ModulesOverview() {
  const { locale } = useI18n()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [modules, setModules] = useState<ModuleView[]>([])
  const [warnings, setWarnings] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

  const load = () =>
    getModuleOverview()
      .then((res) => {
        setModules(res.modules)
        setWarnings(res.dependentWarnings)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const n = (m: ModuleView) => (locale === "en" ? m.nameEn : m.nameSl)
  const d = (m: ModuleView) => (locale === "en" ? m.descriptionEn : m.descriptionSl)
  const cat = (m: ModuleView) =>
    locale === "en" ? CATEGORY_LABEL[m.category].en : CATEGORY_LABEL[m.category].sl

  function toggle(m: ModuleView, next: ModuleView["state"]) {
    startTransition(async () => {
      let res: { success: boolean; error?: string; warnings?: string[]; enabled?: string[] }
      if (next === "ACTIVE") {
        res = await enableModuleWithDependencies(m.id, locale === "en" ? "en" : "sl")
      } else {
        res = await setModuleState(m.id, next)
      }
      if (!res.success) {
        toast.error(res.error ?? "Sprememba ni uspela.")
        return
      }

      if (next === "ACTIVE") {
        const enabledIds = res.enabled ?? []
        const extra = enabledIds.filter((id) => id !== m.id)
        if (extra.length > 0) {
          const extraNames = extra
            .map((id) => {
              const mod = modules.find((x) => x.id === id)
              return mod ? n(mod) : id
            })
            .join(", ")
          toast.success(
            locale === "en"
              ? `Module "${n(m)}" enabled (also enabled: ${extraNames}).`
              : `Modul »${n(m)}« vklopljen (hkrati vklopljeno: ${extraNames}).`
          )
        } else {
          toast.success(
            locale === "en" ? `Module "${n(m)}" enabled.` : `Modul »${n(m)}« vklopljen.`
          )
        }
      } else if (res.warnings && res.warnings.length > 0) {
        for (const w of res.warnings) toast.warning(w)
      } else {
        toast.success(
          next === "DEACTIVATED"
            ? locale === "en"
              ? `Module "${n(m)}" turned off — data is kept.`
              : `Modul »${n(m)}« izklopljen — podatki ostanejo.`
            : locale === "en"
              ? `Module "${n(m)}" hidden from public site.`
              : `Modul »${n(m)}« skrit iz javne strani.`
        )
      }
      router.refresh()
      load()
    })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = CATEGORY_ORDER.flatMap((cat) =>
      modules
        .filter((m) => m.category === cat)
        .sort((a, b) => n(a).localeCompare(n(b)))
    )
    if (!q) return sorted
    return sorted.filter(
      (m) => n(m).toLowerCase().includes(q) || d(m).toLowerCase().includes(q)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules, query, locale])

  const counts = useMemo(() => {
    const c = { required: 0, recommended: 0, available: 0, disabled: 0 }
    for (const m of modules) if (m.category in c) c[m.category as keyof typeof c] += 1
    return c
  }, [modules])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {locale === "en" ? "My modules" : "Moji moduli"}
        </CardTitle>
        <CardDescription>
          {locale === "en"
            ? "Choose which parts of the platform are part of your business. Required modules for your activity are locked; the rest you can turn on or off at any time — data is never lost, re-enabling brings it back."
            : "Izberi, kateri deli platforme so del tvojega poslovanja. Obvezni moduli dejavnosti so zaklenjeni; izbrane lahko vklopiš ali izklopiš kadarkoli — podatki nikoli ne izginejo, ponovni vklop jih vrne."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">
            {locale === "en" ? "Required" : "Obvezni"}: {counts.required}
          </Badge>
          <Badge variant="outline">
            {locale === "en" ? "Recommended/active" : "Priporočeni/aktivni"}: {counts.recommended}
          </Badge>
          <Badge variant="outline">
            {locale === "en" ? "Available" : "Razpoložljivi"}: {counts.available}
          </Badge>
          <Badge variant="outline" className="text-muted-foreground/70">
            {locale === "en" ? "Not available" : "Ni na voljo"}: {counts.disabled}
          </Badge>
        </div>

        <Input
          placeholder={locale === "en" ? "Search module …" : "Išči modul …"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 max-w-sm"
          aria-label={locale === "en" ? "Search modules" : "Iskanje modulov"}
        />

        {loading ? (
          <p className="text-muted-foreground text-sm">
            {locale === "en" ? "Loading modules …" : "Nalagam module …"}
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {locale === "en" ? "No results." : "Ni zadetkov."}
          </p>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((m) => {
              const isLocked = m.category === "required"
              const isUnavailable = m.category === "disabled"
              const deps = (m.dependsOn ?? []).length
              const depWarn = (warnings[m.id] ?? []).length
              return (
                <div
                  key={m.id}
                  className={`rounded-lg border p-3 ${isUnavailable ? "opacity-70" : ""}`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">{n(m)}</p>
                        <Badge
                          variant={
                            isLocked ? "default" : isUnavailable ? "secondary" : "outline"
                          }
                          className="text-[10px]"
                        >
                          {cat(m)}
                        </Badge>
                        {m.hidden && (
                          <Badge variant="secondary" className="text-[10px]">
                            {locale === "en" ? "hidden from public site" : "skrito iz javne strani"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">{d(m)}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground/80">
                        {deps > 0 && (
                          <span>
                            {locale === "en" ? "Needs" : "Potrebuje"}{" "}
                            {m.dependsOn.map((id) => modules.find((x) => x.id === id)?.nameSl ?? id).join(", ")}
                          </span>
                        )}
                        {depWarn > 0 && (
                          <span className="text-amber-600 dark:text-amber-400">
                            {warnings[m.id].join(" ")}
                          </span>
                        )}
                        {(isLocked || isUnavailable) && m.reasonSl && (
                          <span>{locale === "en" && m.reasonEn ? m.reasonEn : m.reasonSl}</span>
                        )}
                      </div>
                    </div>

                    {/* Preklop — onemogočen pri zaklenjenih/nedovoljenih */}
                    <div
                      role="radiogroup"
                      aria-label={n(m)}
                      className="flex shrink-0 overflow-hidden rounded-lg border text-xs"
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={m.state === "ACTIVE"}
                        disabled={pending || loading || isLocked || isUnavailable}
                        onClick={() => toggle(m, "ACTIVE")}
                        className="px-2.5 py-1.5 transition-colors hover:bg-muted/50 disabled:opacity-40"
                      >
                        {locale === "en" ? "On" : "Vklopi"}
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={m.state === "HIDDEN"}
                        disabled={pending || loading || isUnavailable}
                        onClick={() => toggle(m, "HIDDEN")}
                        className="px-2.5 py-1.5 transition-colors hover:bg-muted/50 disabled:opacity-40"
                        title={
                          locale === "en"
                            ? "Hide from public page (module keeps working)"
                            : "Skri iz javne strani (plošča ostane delujoča)"
                        }
                      >
                        {locale === "en" ? "Hide" : "Skrij"}
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={m.state === "DEACTIVATED"}
                        disabled={pending || loading || isLocked || isUnavailable}
                        onClick={() => toggle(m, "DEACTIVATED")}
                        className="px-2.5 py-1.5 transition-colors hover:bg-muted/50 disabled:opacity-40"
                      >
                        {locale === "en" ? "Off" : "Izklopi"}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-muted-foreground text-xs">
          {locale === "en"
            ? "Required modules for your activity are always on and cannot be turned off. Modules not available for your activity stay off. Turning a module off never deletes data — history, bookings and orders stay saved, and re-enabling brings them back."
            : "Obvezni moduli dejavnosti so vedno vklopljeni in jih ni mogoče izklopiti. Moduli, ki niso na voljo za tvojo dejavnost, ostanejo izklopljeni. Izklop nikoli ne zbriše podatkov — zgodovina, rezervacije in naročila ostanejo shranjeni, ponovni vklop jih vrne."}
        </p>
      </CardContent>
    </Card>
  )
}