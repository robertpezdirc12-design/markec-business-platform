"use server"

// EPIC 5 — JAVNA server action skriptnega recepcionista.
//
// Varnostni vzorec (isti kot javni tokovi npr. waitlist/booking): klient
// (chat-widget) uvozi SAMO to action; celotno telo (server-only, next/headers,
// prisma) ostane na strežniku. Najemnik se reši iz PODPISANE glave, ki jo je
// proxy napisal iz URL-ja /s/<slug> ali preverjene custom domene (E5-D9) —
// preprosta fetch na /api/* bi padla na platform root = napacni najemnik.
import { randomBytes } from "node:crypto"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { getPublicOrg } from "@/lib/tenant"
import { resolvePublishGate } from "@/lib/publish-gate"
import { resolvePublicEffectiveProfile } from "@/lib/profiles/resolve"
import { isCapabilityEnabled } from "@/lib/profiles/registry"
import { getLocaleFromCookies } from "@/lib/i18n/server"
import { rateLimit, chatLimits, getClientIp } from "@/lib/rate-limit"
import {
  loadReceptionContext,
  resolveReceptionRequest,
} from "./reception"
import type { ReceptionAction } from "@/lib/reception/intents"

const CONVERSATION_COOKIE = "mkc_conv"
const MAX_MESSAGE_LEN = 2000

/**
 * Anonimen id pogovora: piškotek `mkc_conv` pošlje brskalnik sam (strežnik
 * ga vrne). IDOR: uporabi se SAMO, če je ref že vezan na TO organizacijo —
 * sicer se izda novega. Format je strogo `c_` + 32 hex.
 */
const VISITOR_REF_RE = /^c_[a-f0-9]{32}$/

interface ChatActionResponse {
  ok: boolean
  reply?: string
  intent?: string
  action?: ReceptionAction | null
  suggested?: string[]
  conversationId?: string
  error?: string
}

export async function sendReceptionMessage(message: string): Promise<ChatActionResponse> {
  // Rate limit per IP (fail-open kot ostali javni tokovi — najslabši izid je
  // več avtomatskih odgovorov, ne varnostni incident).
  const ip = await getClientIp()
  const rl = await rateLimit({
    scope: "chat:ip",
    key: `chat:${ip}`,
    ...chatLimits(),
  })
  if (!rl.ok) {
    return { ok: false, error: "rate_limit" }
  }

  const text = (message ?? "").trim().slice(0, MAX_MESSAGE_LEN)
  if (!text) return { ok: false, error: "empty" }

  // Fail-closed: organizacija SAMO iz podpisanega glave / custom domene /
  // platform root; neobjavljen najemnik → bot molči.
  const org = await getPublicOrg()
  if (!org || (await resolvePublishGate(org)) !== "published") {
    return { ok: false, error: "unavailable" }
  }
  const profile = resolvePublicEffectiveProfile(org)
  if (!isCapabilityEnabled(profile, "appointments")) {
    return { ok: false, error: "unavailable" }
  }

  const locale = (await getLocaleFromCookies()) as "sl" | "en"
  const ctx = await loadReceptionContext(
    { id: org.id, name: org.name, slug: org.slug, vertical: org.vertical },
    locale
  )
  const resolution = resolveReceptionRequest(text, ctx)

  const store = await cookies()
  const providedRef = store.get(CONVERSATION_COOKIE)?.value
  let visitorRef = `c_${randomBytes(16).toString("hex")}`
  if (providedRef && VISITOR_REF_RE.test(providedRef)) {
    const existing = await prisma.conversation.findUnique({
      where: {
        organizationId_visitorRef: { organizationId: org.id, visitorRef: providedRef },
      },
      select: { id: true },
    })
    if (existing) visitorRef = providedRef
  }
  // Anonimen piškotek (brez osebnih podatkov) — strežnik ga izda/posodobi.
  // Server Action: cookies().set() nastavi odziven piškotek (Next App Router).
  store.set(CONVERSATION_COOKIE, visitorRef, {
    path: "/",
    maxAge: 30 * 24 * 3600,
    sameSite: "lax",
  })

  // Shranjevanje (obiskovalec + bot) v eni transakciji — pogovor se ne
  // razcepi. Status ostane ACTIVE (inbox lastnika).
  await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.upsert({
      where: {
        organizationId_visitorRef: { organizationId: org.id, visitorRef },
      },
      create: { organizationId: org.id, visitorRef, status: "ACTIVE" },
      update: { lastMessageAt: new Date() },
    })
    await tx.message.create({
      data: { conversationId: conversation.id, sender: "VISITOR", body: text },
    })
    await tx.message.create({
      data: { conversationId: conversation.id, sender: "AUTO", body: resolution.reply },
    })
  })

  return {
    ok: true,
    reply: resolution.reply,
    intent: resolution.intent,
    action: resolution.action ?? null,
    suggested: resolution.suggested,
    conversationId: visitorRef,
  }
}
