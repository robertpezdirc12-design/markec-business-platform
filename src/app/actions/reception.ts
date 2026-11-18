// EPIC 5 — Skriptni recepcionist: strežniška slojna (server-only).
//
// `loadReceptionContext()` sestavi `ReceptionContext` iz baze (org +
// config + siteContent + aktivne storitve). `resolveReceptionRequest()`
// zgradi odgovor z CHISTO jedro (intents.ts) — brez prisma klicev znotraj,
// da ostane testno.
//
// Javna server action `sendReceptionMessage` je v ločenem
// `reception-actions.ts` ("use server"), da klient (chat-widget) ne
// uvozi server-only modula v client bundle. Najemnik se reši iz PODPISANE
// glave, ki jo je proxy napisal iz URL-ja /s/<slug> ali preverjene custom
// domene (E5-D9) — preprosta fetch na /api/* bi padla na platform root
// = NAPACEN najemnik v multi-tenant postavitvi.
import "server-only"
import { prisma } from "@/lib/prisma"
import { mergeSiteContent, formatOpeningHours } from "@/lib/site-content"
import { upgradeLegacyDefaultCopy } from "@/lib/verticals"
import { orgPath } from "@/lib/org-path"
import {
  buildReply,
  classifyIntent,
  type ReceptionAction,
  type ReceptionContext,
} from "@/lib/reception/intents"

// Re-export za teste in kliente (tipi jedra).
export type { ReceptionAction, ReceptionContext } from "@/lib/reception/intents"

export interface ReceptionResolution {
  intent: string
  reply: string
  action?: ReceptionAction
  suggested: string[]
}

/**
 * Naloži vse, kar bot potrebuje: org, telefon, naslov, ure, storitve.
 * Vse iz JAVNIH, že objavljenih virov (SalonConfig + aktivne storitve) —
 * bot nikoli ne vidi internih podatkov (cene brez rab, lastniške nastavitve).
 */
export async function loadReceptionContext(
  org: {
    id: string
    name: string
    slug: string
    vertical: string | null
  },
  locale: "sl" | "en"
): Promise<ReceptionContext> {
  const [config, services] = await Promise.all([
    prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: { siteContent: true, phone: true, address: true },
    }),
    prisma.service.findMany({
      where: { organizationId: org.id, isActive: true },
      orderBy: { order: "asc" },
      take: 8,
      select: { name: true, price: true, duration: true },
    }),
  ])

  const content = upgradeLegacyDefaultCopy(
    mergeSiteContent(config?.siteContent, org.vertical ?? "beauty"),
    org.slug
  )

  return {
    locale,
    orgName: org.name,
    phone: config?.phone ?? null,
    address: config?.address ?? null,
    city: null,
    hours: content.openingHours ? formatOpeningHours(content.openingHours, locale) : [],
    services: services.map((s) => ({
      name: s.name,
      price: Number(s.price),
      durationMin: s.duration,
    })),
    bookingHref: orgPath(org.slug, "/booking"),
    servicesHref: orgPath(org.slug, "/services"),
  }
}

/**
 * Razvrsti obiskovalčev niz + zgradi odgovor. Čista jedro, testno.
 * Strežniško del (loadReceptionContext) se kliče IZVEN te funkcije —
 * tukaj so samo podatki, ki pridejo iz baze (brez DB dostopa).
 */
export function resolveReceptionRequest(
  message: string,
  ctx: ReceptionContext
): ReceptionResolution {
  const intent = classifyIntent(message, ctx.locale)
  const reply = buildReply(intent, ctx)
  return {
    intent,
    reply: reply.text,
    action: reply.action,
    suggested: reply.suggested,
  }
}
