"use client"

// E2-4 (G4): settings card for the org's activities — Google Business
// Profile vzor:
//   • PRIMARY activity: chosen at registration, owns terminology, forms,
//     workflows and site content. Read-only here (GuidedEntryDialog for
//     a deliberate change).
//   • SECONDARY activity: optional, added HERE (not in onboarding) with
//     clear decision criteria and a dilution warning — exactly like GBP
//     advises for additional categories ("add only when you genuinely
//     offer the service AND customers search for it").
//
// Server-side rules: src/lib/profiles/secondary.ts (same codes mirrored
// in the action).

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useI18n } from "@/lib/i18n/provider"
import { EXTENSIONS } from "@/lib/profiles/extensions"
import {
  getOrgActivities,
  setOrgSecondaryVertical,
  type OrgActivitiesInfo,
} from "@/app/actions/profile"
import { GuidedEntryDialog } from "@/components/dashboard/guided-entry"

const CAPABILITY_LABELS: Record<string, { sl: string; en: string }> = {
  appointments: { sl: "Termini in rezervacije", en: "Appointments & bookings" },
  workOrders: { sl: "Delovna naročila", en: "Work orders" },
  shop: { sl: "Spletna trgovina", en: "Online shop" },
  services: { sl: "Katalog storitev", en: "Service catalog" },
  inventory: { sl: "Zaloge", en: "Inventory" },
  customers: { sl: "Stranke", en: "Customers" },
  staff: { sl: "Zaposleni", en: "Staff" },
  analytics: { sl: "Analitika", en: "Analytics" },
  reviews: { sl: "Ocene", en: "Reviews" },
  forms: { sl: "Dinamični obrazci", en: "Dynamic forms" },
  workflows: { sl: "Poslovni procesi", en: "Workflows" },
  documents: { sl: "Dokumenti", en: "Documents" },
  delivery: { sl: "Dostava", en: "Delivery" },
}

function errorCodeToText(code: string, t: ReturnType<typeof useI18n>["t"]): string {
  switch (code) {
    case "UNKNOWN_PROFILE":
      return t.settings.activities.unknownProfile
    case "SAME_PROFILE":
      return t.settings.activities.sameProfile
    case "RESTRICTED":
      return t.settings.activities.restricted
    case "INVALID":
      return t.settings.activities.invalid
    default:
      return t.settings.activities.error
  }
}

/** Google-style decision guide — when is a secondary activity worth it. */
function DecisionGuide({ locale }: { locale: string }) {
  const sl = locale === "sl"
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed">
      <p className="font-medium">{sl ? "Kdaj dodati dodatno dejavnost?" : "When to add a secondary activity?"}</p>
      <ul className="mt-1.5 space-y-1 text-muted-foreground">
        <li>
          ✓ {sl
            ? "Dejansko opravljate to storitev (npr. vulkanizer, ki prodaja tudi pnevmatike)."
            : "You genuinely offer that service (e.g. a tire shop that also sells tires)."}
        </li>
        <li>
          ✓ {sl
            ? "Stranke jo iščejo kot ločeno dejavnost (ločena povpraševanja, ločena ciljna publika)."
            : "Customers search for it as a distinct trade (separate queries, separate audience)."}
        </li>
        <li className="text-amber-600 dark:text-amber-400">
          ⚠ {sl
            ? "Ne dodajajte je, če samo 'morda nekoč' — vsaka dodatna dejavnost rahlo razprši fokus vašega profila."
            : "Don't add it just 'maybe someday' — each additional activity slightly dilutes your profile's focus."}
        </li>
      </ul>
    </div>
  )
}

/** What the secondary activity changes vs. what stays primary. */
function ImpactSummary({
  data,
  locale,
}: {
  data: OrgActivitiesInfo
  locale: string
}) {
  const sl = locale === "sl"
  if (!data.secondaryId) return null
  return (
    <div className="grid gap-2 text-xs sm:grid-cols-2">
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
        <p className="font-medium text-emerald-700 dark:text-emerald-400">
          {sl ? "Dodaja se:" : "Adds:"}
        </p>
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          <li>• {sl ? "Novi moduli (npr. trgovina, zaloge)" : "New modules (e.g. shop, inventory)"}</li>
          <li>• {sl ? "Dodatne kategorije v katalogu" : "Extra catalog categories"}</li>
          <li>• {sl ? "Razširjeni dostop do funkcij" : "Extended feature access"}</li>
        </ul>
      </div>
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="font-medium">
          {sl ? "Ostane od primarne:" : "Stays primary:"}
        </p>
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          <li>• {sl ? "Jezik in terminologija" : "Language & terminology"}</li>
          <li>• {sl ? "Obrazci in procesi" : "Forms & workflows"}</li>
          <li>• {sl ? "Vsebina spletne strani" : "Website content"}</li>
        </ul>
      </div>
    </div>
  )
}

export function ActivitiesCard() {
  const { t, locale } = useI18n()
  const [data, setData] = useState<OrgActivitiesInfo | { error: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    getOrgActivities()
      .then((res) => {
        if (cancelled) return
        setData(res)
      })
      .catch(() => {
        if (!cancelled) setData({ error: "load" })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-9 w-full sm:w-72" />
          <Skeleton className="h-6 w-2/3" />
        </CardContent>
      </Card>
    )
  }

  if (!data || "error" in data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.activities.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{t.settings.activities.loadError}</p>
        </CardContent>
      </Card>
    )
  }

  const hasContribution =
    data.secondaryId != null &&
    (data.contribution.capabilities.length > 0 || data.contribution.extensions.length > 0)

  function save(next: string | null) {
    startTransition(async () => {
      const res = await setOrgSecondaryVertical({ secondaryVertical: next })
      if (res.ok) {
        // The union changes nav/dashboard everywhere → full reload shows
        // the new state (toast would be killed by the reload anyway).
        window.location.reload()
      } else {
        toast.error(errorCodeToText(res.error ?? "GENERIC", t))
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{t.settings.activities.title}</CardTitle>
            <CardDescription>{t.settings.activities.description}</CardDescription>
          </div>
          {/* Guided entry ("vodeni vstop"): switch the PRIMARY activity —
              modules, terminology and forms all follow. */}
          <GuidedEntryDialog triggerLabel={t.settings.guidedEntry.reopenButton} dict={t.settings.guidedEntry} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Primary activity — read-only, owns terminology. */}
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {t.settings.activities.primary}
            </p>
            <Badge variant="outline" className="mt-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              {data.primaryLabel}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {locale === "sl"
              ? "Primarna dejavnost določa jezik, obrazce in vsebino strani."
              : "The primary activity owns language, forms and site content."}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Secondary activity — optional, with decision guide. */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">
              {locale === "sl" ? "Dodatna dejavnost (neobvezno)" : "Secondary activity (optional)"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {locale === "sl"
                ? "Dodajte jo samo, če dejansko opravljate obe dejavnosti — npr. vulkanizer + trgovina."
                : "Add one only if you genuinely run both activities — e.g. tire shop + store."}
            </p>
          </div>

          <Select
            value={data.secondaryId ?? "none"}
            onValueChange={(v) => {
              const next = v === "none" ? null : v
              if (next === data.secondaryId) return
              save(next)
            }}
            disabled={pending}
          >
            <SelectTrigger
              className="w-full sm:w-72"
              aria-label={t.settings.activities.secondary}
            >
              <SelectValue placeholder={t.settings.activities.secondaryPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t.settings.activities.secondaryNone}</SelectItem>
              {data.options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {pending && (
            <span className="text-xs text-muted-foreground" role="status">
              …
            </span>
          )}

          {/* Decision guide — Google-style "when to add" criteria. */}
          <DecisionGuide locale={locale} />

          {/* Impact summary — what changes, what stays. */}
          <ImpactSummary data={data} locale={locale} />

          {/* Capability badges — concrete list of what gets added. */}
          {hasContribution && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {t.settings.activities.addsLabel}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {data.contribution.capabilities.map((cap) => (
                  <Badge key={cap} variant="secondary">
                    {CAPABILITY_LABELS[cap]?.[locale] ?? cap}
                  </Badge>
                ))}
                {data.contribution.extensions.map((ext) => (
                  <Badge key={ext} variant="outline">
                    {EXTENSIONS[ext]?.name ?? ext}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
