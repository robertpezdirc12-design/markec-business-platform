"use server"

// EPIC 5 — Inbox za lastnika: pogovori skriptnega recepcionista.
//
// Vsi klici org-scoped prek requirePermissionOrg (isti prag kot
// waitlist/appointments — appointments.view). Pogovor je vedno vezan
// na organizationId: ni IDOR-a (ni mogoče odpreti pogovor tuje org).

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"

export interface ConversationSummary {
  id: string
  status: string
  visitorRef: string
  lastMessageAt: Date
  preview: string | null
  previewSender: string | null
  unreadCount: number
}

export interface ConversationDetail extends ConversationSummary {
  messages: {
    id: string
    sender: string
    body: string
    createdAt: Date
  }[]
}

const MAX_BODY = 2000

/** Seznam pogovorov trenutne org (najnovejši zadnji). */
export async function getConversations(): Promise<{
  ok: boolean
  error?: string
  conversations?: ConversationSummary[]
}> {
  try {
    const { org } = await requirePermissionOrg("appointments.view")
    const conversations = await prisma.conversation.findMany({
      where: { organizationId: org.id },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    })
    return {
      ok: true,
      conversations: conversations.map((c) => ({
        id: c.id,
        status: c.status,
        visitorRef: c.visitorRef,
        lastMessageAt: c.lastMessageAt,
        preview: c.messages[0]?.body ?? null,
        previewSender: c.messages[0]?.sender ?? null,
        unreadCount: 0,
      })),
    }
  } catch (e) {
    return { ok: false, error: (e as { message?: string }).message ?? "Napaka" }
  }
}

/** Pogled na en pogovor (z zgodovino, max 100 sporočil). */
export async function getConversation(id: string): Promise<{
  ok: boolean
  error?: string
  conversation?: ConversationDetail
}> {
  try {
    const { org } = await requirePermissionOrg("appointments.view")
    const c = await prisma.conversation.findFirst({
      where: { id, organizationId: org.id },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } },
    })
    if (!c) return { ok: false, error: "Pogovor ne obstaja." }
    const last = c.messages[c.messages.length - 1]
    return {
      ok: true,
      conversation: {
        id: c.id,
        status: c.status,
        visitorRef: c.visitorRef,
        lastMessageAt: c.lastMessageAt,
        preview: last?.body ?? null,
        previewSender: last?.sender ?? null,
        unreadCount: 0,
        messages: c.messages.map((m) => ({
          id: m.id,
          sender: m.sender,
          body: m.body,
          createdAt: m.createdAt,
        })),
      },
    }
  } catch (e) {
    return { ok: false, error: (e as { message?: string }).message ?? "Napaka" }
  }
}

/** Lastniški odgovor — označi pogovor REPLIED. */
export async function replyToConversation(
  id: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const text = body.trim().slice(0, MAX_BODY)
    if (!text) return { ok: false, error: "Sporočilo je prazno." }
    const { org } = await requirePermissionOrg("appointments.manage")
    const c = await prisma.conversation.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    })
    if (!c) return { ok: false, error: "Pogovor ne obstaja." }
    await prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: { conversationId: id, sender: "OWNER", body: text },
      })
      await tx.conversation.update({
        where: { id },
        data: { status: "REPLIED", lastMessageAt: new Date() },
      })
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as { message?: string }).message ?? "Napaka" }
  }
}
