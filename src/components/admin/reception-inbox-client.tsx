"use client"

// EPIC 5 — Inbox za lastnika: seznam pogovorov + pogled + odgovor.
// Enostavni master/detail brez zunanje knjižnice: klik na pogovor
// odpre zgodovino (getConversation), odgovor (replyToConversation)
// označi REPLIED. Podatki so RSC-varni plain objekti.

import { useCallback, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format } from "date-fns"
import { sl } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeftIcon, EnvelopeIcon, SparkleIcon, SendIcon } from "@/components/icons"
import { useI18n } from "@/lib/i18n/provider"
import {
  getConversation,
  replyToConversation,
  type ConversationSummary,
} from "@/app/actions/reception-owner"

interface MessageView {
  id: string
  sender: string
  body: string
  createdAt: string
}

interface ConversationView {
  id: string
  status: string
  visitorRef: string
  preview: string | null
  previewSender: string | null
  lastMessageAt: string
  messages: MessageView[]
}

export function ReceptionInboxClient({
  conversations,
}: {
  conversations: ConversationSummary[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "REPLIED">("ALL")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<ConversationView | null>(null)
  const [reply, setReply] = useState("")
  const labels = useI18n().t.appointments.inbox
  const locale = useI18n().locale

  const visible =
    filter === "ALL"
      ? conversations
      : conversations.filter((c) => c.status === filter)

  const counts: Record<string, number> = {
    ALL: conversations.length,
    ACTIVE: conversations.filter((c) => c.status === "ACTIVE").length,
    REPLIED: conversations.filter((c) => c.status === "REPLIED").length,
  }

  const openConversation = useCallback(
    (id: string) => {
      startTransition(async () => {
        const res = await getConversation(id)
        if (res.ok && res.conversation) {
          // Dategre → ISO stringi (RSC varno).
          const src = res.conversation
          const c: ConversationView = {
            id: src.id,
            status: src.status,
            visitorRef: src.visitorRef,
            preview: src.preview,
            previewSender: src.previewSender,
            lastMessageAt: new Date(src.lastMessageAt).toISOString(),
            messages: src.messages.map((m) => ({
              id: m.id,
              sender: m.sender,
              body: m.body,
              createdAt: new Date(m.createdAt).toISOString(),
            })),
          }
          setSelectedId(id)
          setConversation(c)
          setReply("")
        } else {
          toast.error(res.error ?? labels.replyFailed)
        }
      })
    },
    [labels.replyFailed]
  )

  const closeConversation = () => {
    setSelectedId(null)
    setConversation(null)
    setReply("")
  }

  const sendReply = () => {
    if (!selectedId || !reply.trim()) return
    startTransition(async () => {
      const res = await replyToConversation(selectedId, reply)
      if (res.ok) {
        toast.success(labels.replySuccess)
        setReply("")
        router.refresh()
        // Osveži zgodovino (dodaj naš odgovor).
        const detail = await getConversation(selectedId)
        if (detail.ok && detail.conversation) {
          const src = detail.conversation
          setConversation({
            id: src.id,
            status: src.status,
            visitorRef: src.visitorRef,
            preview: src.preview,
            previewSender: src.previewSender,
            lastMessageAt: new Date(src.lastMessageAt).toISOString(),
            messages: src.messages.map((m) => ({
              id: m.id,
              sender: m.sender,
              body: m.body,
              createdAt: new Date(m.createdAt).toISOString(),
            })),
          })
        }
      } else {
        toast.error(res.error ?? labels.replyFailed)
      }
    })
  }

  const senderLabel = (s: string) =>
    s === "VISITOR" ? labels.visitor : s === "OWNER" ? labels.owner : labels.auto
  const fmt = (d: string | Date) =>
    format(typeof d === "string" ? new Date(d) : d, "d. MMM yyyy, HH:mm", {
      locale: locale === "sl" ? sl : undefined,
    })

  // ---------- Pogled na posamezni pogovor ----------
  if (selectedId && conversation) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={closeConversation}
          className="gap-1.5"
        >
          <ArrowLeftIcon size={16} />
          {labels.backToAll}
        </Button>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-muted p-2 text-primary-text">
                <EnvelopeIcon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {senderLabel(conversation.previewSender ?? "VISITOR")}
                </p>
                <p className="text-muted-foreground text-xs">
                  {fmt(conversation.lastMessageAt)}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  conversation.status === "ACTIVE"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {conversation.status === "ACTIVE"
                  ? labels.statusActive
                  : labels.statusReplied}
              </span>
            </div>

            {/* Zgodovina */}
            <div className="max-h-[420px] space-y-3 overflow-y-auto">
              {conversation.messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.sender === "VISITOR"
                      ? "flex justify-start"
                      : m.sender === "OWNER"
                        ? "flex justify-end"
                        : "flex justify-center"
                  }
                >
                  <div
                    className={
                      m.sender === "VISITOR"
                        ? "max-w-[80%] rounded-2xl rounded-bl-sm border border-border bg-background px-3 py-2"
                        : m.sender === "OWNER"
                          ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground"
                          : "max-w-[90%] rounded-2xl bg-muted px-3 py-2"
                    }
                  >
                    <p className="whitespace-pre-line break-words text-sm">{m.body}</p>
                    <p
                      className={`mt-1 text-[10px] ${
                        m.sender === "OWNER" ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}
                    >
                      {senderLabel(m.sender)} · {fmt(m.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Odgovor */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                sendReply()
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={labels.replyPlaceholder}
                rows={2}
                className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <Button type="submit" size="sm" disabled={pending || !reply.trim()} className="gap-1.5">
                <SendIcon size={15} weight="bold" />
                {labels.send}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---------- Seznam pogovorov ----------
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["ALL", labels.filterAll],
            ["ACTIVE", labels.statusActive],
            ["REPLIED", labels.statusReplied],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              filter === value
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "hover:border-primary/40"
            }`}
          >
            {label}
            <span className="text-muted-foreground ml-1.5 text-xs">{counts[value] ?? 0}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            {labels.empty}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((c) => (
            <Card key={c.id}>
              <button
                type="button"
                onClick={() => openConversation(c.id)}
                className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/40"
              >
                <div className="rounded-lg bg-muted p-2 text-primary-text">
                  <EnvelopeIcon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {senderLabel(c.previewSender ?? "VISITOR")}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        c.status === "ACTIVE"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {c.status === "ACTIVE" ? labels.statusActive : labels.statusReplied}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 truncate text-sm">
                    {c.preview ?? labels.previewNone}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {labels.lastMessage}: {fmt(c.lastMessageAt)}
                  </p>
                </div>
                <SparkleIcon size={14} className="mt-1 shrink-0 text-primary/40" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
