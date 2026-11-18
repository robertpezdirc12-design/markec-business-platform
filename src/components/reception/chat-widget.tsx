"use client"

// EPIC 5 — Skriptni recepcionist: javni chat widget.
//
// Tanak klient: klika SERVER ACTION `sendReceptionMessage` (isti vzorec
// kot čakalna lista/rezervacija — E5-D9). Server action deduje PODPISANO
// najemniško glavo iz konteksta strani /s/<slug>, zato je najemnik vedno
// pravilni — preprosta fetch na /api/* bi padla na platform root.
// Vse odločitve so na strežniku (intents.ts + DB); widget NI vir podatkov.

import { useCallback, useEffect, useRef, useState } from "react"
import { ChatsCircle, X, Sparkle, PaperPlaneRight } from "@phosphor-icons/react/dist/ssr"
import { useI18n } from "@/lib/i18n/context"
import { sendReceptionMessage } from "@/app/actions/reception-actions"
import type { ReceptionAction } from "@/lib/reception/intents"

interface Message {
  id: number
  sender: "VISITOR" | "AUTO"
  body: string
  action?: ReceptionAction
  suggested?: string[]
}

const MAX_RENDER_LEN = 2000

export function ChatWidget() {
  const { locale } = useI18n()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nextId = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Drži se do dna pri novih sporočilih.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  // Osredotoči polje, ko se okno odpre (dobra UX).
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const push = useCallback((m: Omit<Message, "id">) => {
    nextId.current += 1
    const id = nextId.current
    setMessages((prev) => [...prev.slice(-19), { ...m, id }])
  }, [])

  const isSl = locale === "sl"

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim().slice(0, MAX_RENDER_LEN)
      if (!trimmed || sending) return
      setInput("")
      setError(null)
      push({ sender: "VISITOR", body: trimmed })
      setSending(true)
      try {
        const res = await sendReceptionMessage(trimmed)
        if (!res.ok) {
          const isSlLocal = isSl
          setError(
            res.error === "rate_limit"
              ? isSlLocal
                ? "Preveč povpraševanj — počakajte minuto in poskusite znova."
                : "Too many requests — wait a minute and try again."
              : isSlLocal
                ? "Napaka pri pošiljanju. Poskusite znova."
                : "Something went wrong. Please try again."
          )
          return
        }
        push({
          sender: "AUTO",
          body: res.reply ?? "",
          action: res.action ?? undefined,
          suggested: res.suggested,
        })
      } catch {
        setError(
          isSl
            ? "Ni povezave. Poskusite znova."
            : "No connection. Please try again."
        )
      } finally {
        setSending(false)
      }
    },
    [isSl, sending, push]
  )

  const label = isSl ? "Sprejem 24/7" : "Reception 24/7"
  const placeholder = isSl
    ? "Vprašajte … (cene, ure, termin)"
    : "Ask … (prices, hours, appointment)"
  const sendLabel = isSl ? "Pošlji" : "Send"
  const closeLabel = isSl ? "Zapri" : "Close"
  const autoTitle = isSl ? "Sprejem" : "Reception"

  return (
    <>
      {/* Gumb — desni spodnji kot. Zelo majhen, ne moti. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
      >
        {open ? <X size={22} weight="bold" /> : <ChatsCircle size={26} weight="fill" />}
      </button>

      {/* Okno */}
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="fixed bottom-20 right-4 z-50 flex h-[420px] max-h-[70vh] w-[340px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
        >
          {/* Glava */}
          <div className="flex items-center justify-between gap-2 border-b border-border bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkle size={18} className="text-primary" />
              <div>
                <p className="text-sm font-semibold leading-tight">{label}</p>
                <p className="text-xs text-muted-foreground leading-tight">
                  {isSl ? "Takojšnji odgovor" : "Instant reply"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={closeLabel}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>

          {/* Sporočila */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <ChatsCircle size={28} className="text-primary/40" />
                <p>
                  {isSl
                    ? "Pozdravljeni! Vprašajte me o cenah, urah ali rezervaciji."
                    : "Hello! Ask me about prices, hours or booking."}
                </p>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.sender === "VISITOR"
                    ? "flex justify-end"
                    : "flex justify-start"
                }
              >
                <div
                  className={
                    m.sender === "VISITOR"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-card px-3 py-2 text-sm text-card-foreground"
                  }
                >
                  <p className="whitespace-pre-line break-words">{m.body}</p>
                  {m.sender === "AUTO" && m.action && (
                    <a
                      href={m.action.href}
                      className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      {m.action.label}
                    </a>
                  )}
                  {m.sender === "AUTO" && m.suggested && m.suggested.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.suggested.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => send(s)}
                          disabled={sending}
                          className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {m.sender === "AUTO" && (
                    <p className="mt-1 text-[10px] text-muted-foreground">{autoTitle}</p>
                  )}
                </div>
              </div>
            ))}
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Vnos */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="flex items-center gap-2 border-t border-border bg-background px-3 py-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              maxLength={MAX_RENDER_LEN}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label={sendLabel}
              className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <PaperPlaneRight size={16} weight="bold" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
