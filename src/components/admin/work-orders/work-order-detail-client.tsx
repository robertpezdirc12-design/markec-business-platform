"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  getOrCreateWorkOrderShareLink,
  recordWorkOrderPayment,
  setWorkOrderDeposit,
} from "@/app/actions/work-order-payments"
import {
  advanceWorkOrder,
  cancelWorkOrder,
  addWorkOrderNote,
  updateWorkOrderTerms,
  type WorkOrderDetail,
} from "@/app/actions/work-orders"

// ============================================================
// WORK ORDER DETAIL (client) — stage stepper with VALIDATED
// transitions (server allows adjacent stages only), cancel,
// internal notes and the append-only audit timeline.
// ============================================================

interface Labels {
  stage: string
  status: string
  priority: string
  customer: string
  dueDate: string
  notes: string
  created: string
  noCustomer: string
  statusLabels: Record<string, string>
  priorityLabels: Record<string, string>
  workflow: string
  history: string
  advance: string
  back: string
  cancel: string
  addNote: string
  notePlaceholder: string
  noteAdded: string
  noHistory: string
  stageOfTemplate: string
  finalStage: string
  /** Predračun: naslov kartice, namig, polji in potrditev. */
  quoteTitle: string
  quoteHint: string
  quote: string
  quoteSave: string
  quoteSaved: string
  /** Denar na naročilu + javna povezava za stranko. */
  money: {
    title: string
    hint: string
    deposit: string
    depositSave: string
    paid: string
    balance: string
    total: string
    stateLabels: Record<string, string>
    recordTitle: string
    amount: string
    method: string
    methodCash: string
    methodCard: string
    methodTransfer: string
    note: string
    record: string
    recorded: string
    history: string
    noPayments: string
    methodStripe: string
    methodOther: string
  }
  share: {
    title: string
    hint: string
    create: string
    created: string
    copy: string
    copied: string
    open: string
    rotate: string
    approved: string
    declined: string
    waiting: string
    reason: string
  }
}

interface WorkOrderDetailClientProps {
  order: WorkOrderDetail
  labels: Labels
  errorLabels: Record<string, string>
  locale: string
}

export function WorkOrderDetailClient({
  order,
  labels,
  errorLabels,
  locale,
}: WorkOrderDetailClientProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState("")
  // Predračun: znesek + rok (model ju je imel, UI ju ni ponujal).
  const [quoteAmount, setQuoteAmount] = useState(
    order.total === null ? "" : String(order.total)
  )
  const [quoteDue, setQuoteDue] = useState(
    order.dueDate ? order.dueDate.slice(0, 10) : ""
  )
  // Denar na naročilu (depozit + prejeta plačila) in javna povezava.
  const [depositInput, setDepositInput] = useState(
    order.money.depositAmount === null ? "" : String(order.money.depositAmount)
  )
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "transfer">("cash")
  const [payNote, setPayNote] = useState("")
  const [sharePath, setSharePath] = useState<string | null>(order.share.path)
  const recordsLinkLabel = locale === "sl" ? "Odpri evidence" : "Open records"

  const stages = order.workflow?.stages ?? []
  const currentStage = stages.find((s) => s.key === order.currentStageKey)
  const currentIndex = currentStage ? currentStage.order : -1
  const isOpen = order.status === "OPEN"
  const nextStage = isOpen && currentIndex >= 0 ? stages[currentIndex + 1] : undefined
  const prevStage = isOpen && currentIndex > 0 ? stages[currentIndex - 1] : undefined

  const errorText = (code?: string) =>
    (code && errorLabels[code]) || errorLabels.GENERIC

  const move = (toStageKey: string) => {
    startTransition(async () => {
      const result = await advanceWorkOrder(order.id, toStageKey)
      if (result.ok) {
        router.refresh()
      } else {
        toast.error(errorText(result.error))
      }
    })
  }

  const cancel = () => {
    startTransition(async () => {
      const result = await cancelWorkOrder(order.id)
      if (result.ok) {
        toast.success(labels.statusLabels.CANCELLED)
        router.refresh()
      } else {
        toast.error(errorText(result.error))
      }
    })
  }

  const submitNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!note.trim()) return
    startTransition(async () => {
      const result = await addWorkOrderNote(order.id, note)
      if (result.ok) {
        toast.success(labels.noteAdded)
        setNote("")
        router.refresh()
      } else {
        toast.error(errorText(result.error))
      }
    })
  }

  const saveQuote = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = quoteAmount.trim().replace(",", ".")
    const total = trimmed === "" ? null : Number(trimmed)
    if (total !== null && (!Number.isFinite(total) || total < 0)) {
      toast.error(errorText("INVALID_TOTAL"))
      return
    }
    startTransition(async () => {
      const result = await updateWorkOrderTerms(order.id, {
        total,
        dueDate: quoteDue === "" ? null : quoteDue,
      })
      if (result.ok) {
        toast.success(labels.quoteSaved)
        router.refresh()
      } else {
        toast.error(errorText(result.error))
      }
    })
  }

  const saveDeposit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = depositInput.trim().replace(",", ".")
    startTransition(async () => {
      const res = await setWorkOrderDeposit(order.id, {
        amount: trimmed === "" ? null : trimmed,
      })
      if (res.ok) {
        toast.success(labels.quoteSaved)
        router.refresh()
      } else toast.error(errorText(res.error))
    })
  }

  const submitPayment = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await recordWorkOrderPayment(order.id, {
        amount: payAmount,
        method: payMethod,
        note: payNote || null,
      })
      if (res.ok) {
        toast.success(labels.money.recorded)
        setPayAmount("")
        setPayNote("")
        router.refresh()
      } else toast.error(errorText(res.error))
    })
  }

  const createShareLink = (rotate = false) => {
    startTransition(async () => {
      const res = await getOrCreateWorkOrderShareLink(order.id, { rotate })
      if (res.ok && res.path) {
        setSharePath(res.path)
        toast.success(labels.share.created)
        router.refresh()
      } else toast.error(errorText(res.error))
    })
  }

  const copyShareLink = () => {
    if (!sharePath) return
    const url = `${window.location.origin}${sharePath}`
    navigator.clipboard?.writeText(url)
    toast.success(labels.share.copied)
  }

  const money = order.money.summary
  const eur = (n: number) =>
    `${n.toLocaleString(locale === "en" ? "en-GB" : "sl-SI", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} €`

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "sl-SI", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main column */}
      <div className="space-y-6 lg:col-span-2">
        {/* Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <div className="text-muted-foreground text-xs font-mono">
                  #{String(order.number).padStart(3, "0")}
                </div>
                <h1 className="mt-1 text-xl font-bold sm:text-2xl">{order.title}</h1>
                <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>
                    {labels.status}:{" "}
                    <span className="text-foreground font-medium">
                      {labels.statusLabels[order.status] ?? order.status}
                    </span>
                  </span>
                  <span>
                    {labels.priority}:{" "}
                    <span className="text-foreground font-medium">
                      {labels.priorityLabels[order.priority] ?? order.priority}
                    </span>
                  </span>
                  <span>
                    {labels.dueDate}:{" "}
                    <span className="text-foreground font-medium">{fmtDate(order.dueDate)}</span>
                  </span>
                  <span>
                    {labels.quote}:{" "}
                    <span className="text-foreground font-medium">
                      {order.total === null
                        ? "—"
                        : `${order.total.toLocaleString(locale === "en" ? "en-GB" : "sl-SI", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} €`}
                    </span>
                  </span>
                  {order.sourceSubmissionId && (
                    <span className="text-primary-text">⎘ {labels.created} (obrazec)</span>
                  )}
                </div>
              </div>
              {isOpen && (
                <Button variant="outline" size="sm" onClick={cancel} disabled={pending}>
                  {labels.cancel}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Predračun — znesek in rok izdelave (stopnja 3 je prej le "naprej") */}
        {isOpen && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{labels.quoteTitle}</CardTitle>
              <p className="text-muted-foreground text-sm">{labels.quoteHint}</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveQuote} className="flex flex-wrap items-end gap-3">
                <div className="min-w-32 flex-1">
                  <label
                    htmlFor="quote-amount"
                    className="text-muted-foreground mb-1 block text-xs font-medium"
                  >
                    {labels.quote} (€)
                  </label>
                  <Input
                    id="quote-amount"
                    inputMode="decimal"
                    placeholder="npr. 45,00"
                    value={quoteAmount}
                    onChange={(e) => setQuoteAmount(e.target.value)}
                  />
                </div>
                <div className="min-w-40 flex-1">
                  <label
                    htmlFor="quote-due"
                    className="text-muted-foreground mb-1 block text-xs font-medium"
                  >
                    {labels.dueDate}
                  </label>
                  <Input
                    id="quote-due"
                    type="date"
                    value={quoteDue}
                    onChange={(e) => setQuoteDue(e.target.value)}
                  />
                </div>
                <Button type="submit" size="sm" disabled={pending}>
                  {labels.quoteSave}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Denar na naročilu: depozit, prejeta plačila in preostanek */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{labels.money.title}</CardTitle>
            <p className="text-muted-foreground text-sm">{labels.money.hint}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground text-xs">{labels.money.total}</p>
                <p className="font-semibold tabular-nums">
                  {money.total === null ? "—" : eur(money.total)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{labels.money.deposit}</p>
                <p className="font-semibold tabular-nums">
                  {money.depositAmount === null ? "—" : eur(money.depositAmount)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{labels.money.paid}</p>
                <p className="font-semibold tabular-nums">{eur(money.paid)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{labels.money.balance}</p>
                <p
                  className={cn(
                    "font-semibold tabular-nums",
                    money.state === "PAID" && "text-emerald-600",
                    money.state === "PARTIAL" && "text-amber-600"
                  )}
                >
                  {eur(money.balance)}
                </p>
              </div>
            </div>

            <p className="text-muted-foreground text-xs">
              {labels.money.stateLabels[money.state] ?? money.state}
            </p>

            {isOpen && (
              <form onSubmit={saveDeposit} className="flex flex-wrap items-end gap-2 border-t pt-3">
                <div className="min-w-32 flex-1">
                  <label htmlFor="deposit-amount" className="text-muted-foreground mb-1 block text-xs">
                    {labels.money.deposit}
                  </label>
                  <Input
                    id="deposit-amount"
                    inputMode="decimal"
                    placeholder="npr. 20,00"
                    value={depositInput}
                    onChange={(e) => setDepositInput(e.target.value)}
                  />
                </div>
                <Button type="submit" size="sm" variant="outline" disabled={pending}>
                  {labels.money.depositSave}
                </Button>
              </form>
            )}

            {isOpen && (
              <form onSubmit={submitPayment} className="space-y-2 border-t pt-3">
                <p className="text-sm font-medium">{labels.money.recordTitle}</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-28">
                    <label htmlFor="pay-amount" className="text-muted-foreground mb-1 block text-xs">
                      {labels.money.amount}
                    </label>
                    <Input
                      id="pay-amount"
                      inputMode="decimal"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                    />
                  </div>
                  <div className="min-w-32 flex-1">
                    <label htmlFor="pay-method" className="text-muted-foreground mb-1 block text-xs">
                      {labels.money.method}
                    </label>
                    <select
                      id="pay-method"
                      value={payMethod}
                      onChange={(e) =>
                        setPayMethod(e.target.value as "cash" | "card" | "transfer")
                      }
                      className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
                    >
                      <option value="cash">{labels.money.methodCash}</option>
                      <option value="card">{labels.money.methodCard}</option>
                      <option value="transfer">{labels.money.methodTransfer}</option>
                    </select>
                  </div>
                  <div className="min-w-40 flex-[2]">
                    <label htmlFor="pay-note" className="text-muted-foreground mb-1 block text-xs">
                      {labels.money.note}
                    </label>
                    <Input
                      id="pay-note"
                      value={payNote}
                      onChange={(e) => setPayNote(e.target.value)}
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={pending || !payAmount}>
                    {labels.money.record}
                  </Button>
                </div>
              </form>
            )}

            <div className="border-t pt-3">
              <p className="text-sm font-medium">{labels.money.history}</p>
              {order.money.payments.length === 0 ? (
                <p className="text-muted-foreground text-sm">{labels.money.noPayments}</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {order.money.payments.map((p) => (
                    <li key={p.id} className="flex justify-between border-b py-1 last:border-0">
                      <span className="text-muted-foreground">
                        {fmtDate(p.paidAt)} ·{" "}
                        {p.method === "stripe"
                          ? labels.money.methodStripe
                          : p.method === "cash"
                            ? labels.money.methodCash
                            : p.method === "card"
                              ? labels.money.methodCard
                              : p.method === "transfer"
                                ? labels.money.methodTransfer
                                : labels.money.methodOther}
                        {p.note ? ` · ${p.note}` : ""}
                      </span>
                      <span className="font-medium tabular-nums">{eur(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Javna povezava za stranko: potrditev predračuna + depozit */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{labels.share.title}</CardTitle>
            <p className="text-muted-foreground text-sm">{labels.share.hint}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              {order.share.customerApprovedAt
                ? `${labels.share.approved} · ${fmtDate(order.share.customerApprovedAt)}`
                : order.share.customerDeclinedAt
                  ? `${labels.share.declined} · ${fmtDate(order.share.customerDeclinedAt)}`
                  : labels.share.waiting}
              {order.share.declineReason
                ? ` — ${labels.share.reason}: ${order.share.declineReason}`
                : ""}
            </p>

            {sharePath ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1 text-xs">
                    {sharePath}
                  </code>
                  <Button type="button" size="sm" variant="outline" onClick={copyShareLink}>
                    {labels.share.copy}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" asChild>
                    <Link href={sharePath} target="_blank" rel="noopener noreferrer">
                      {labels.share.open}
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => createShareLink(true)}
                  >
                    {labels.share.rotate}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => createShareLink(false)}
              >
                {labels.share.create}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Stage stepper */}
        {stages.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {labels.workflow}: {order.workflow?.name}
                </CardTitle>
                {currentIndex >= 0 && (
                  <span className="text-muted-foreground text-xs">
                    {labels.stageOfTemplate
                      .replace("{current}", String(currentIndex + 1))
                      .replace("{total}", String(stages.length))}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-y-3">
                {stages.map((stage, i) => {
                  const done = currentIndex > stage.order || order.status === "COMPLETED"
                  const isCurrent = stage.key === order.currentStageKey && isOpen
                  return (
                    <div key={stage.key} className="flex items-center">
                      {i > 0 && (
                        <div
                          className={cn(
                            "h-0.5 w-4 sm:w-8",
                            done || isCurrent ? "bg-primary" : "bg-border"
                          )}
                        />
                      )}
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors",
                            done && "border-primary bg-primary text-primary-foreground",
                            isCurrent &&
                              "border-primary text-primary-text bg-primary/10 ring-primary/20 ring-4",
                            !done && !isCurrent && "border-border bg-background text-muted-foreground"
                          )}
                        >
                          {done ? "✓" : i + 1}
                        </div>
                        <span
                          className={cn(
                            "max-w-20 truncate text-center text-[11px] leading-tight",
                            isCurrent ? "text-primary-text font-semibold" : "text-muted-foreground"
                          )}
                          title={stage.name}
                        >
                          {stage.name}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {currentStage?.description && isOpen && (
                <p className="text-muted-foreground text-sm">{currentStage.description}</p>
              )}

              {/* Validated transitions */}
              {isOpen && (
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  {prevStage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => move(prevStage.key)}
                      disabled={pending}
                    >
                      ← {labels.back} ({prevStage.name})
                    </Button>
                  )}
                  {nextStage && (
                    <Button
                      size="sm"
                      onClick={() => move(nextStage.key)}
                      disabled={pending}
                    >
                      {nextStage.isFinal ? labels.advance + " — " + labels.statusLabels.COMPLETED : labels.advance} →{" "}
                      {nextStage.name}
                    </Button>
                  )}
                  {!nextStage && currentStage?.isFinal === false && (
                    <span className="text-muted-foreground text-sm">{labels.finalStage}</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notes + timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.history}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={submitNote} className="flex gap-2">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={labels.notePlaceholder}
                rows={2}
                className="min-h-0 flex-1"
              />
              <Button type="submit" size="sm" disabled={pending || !note.trim()}>
                {labels.addNote}
              </Button>
            </form>

            {order.events.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                {labels.noHistory}
              </p>
            ) : (
              <ol className="space-y-3">
                {[...order.events].reverse().map((ev) => (
                  <li key={ev.id} className="border-border/60 flex gap-3 border-l pl-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">
                          {ev.type === "STAGE_CHANGED" && (ev.message ?? labels.stage)}
                          {ev.type === "CREATED" && (ev.message ?? labels.created)}
                          {ev.type === "NOTE" && (ev.message ?? "")}
                          {ev.type === "STATUS_CHANGED" && (ev.message ?? "")}
                        </span>
                        {ev.fromStageKey && ev.toStageKey && (
                          <span className="text-muted-foreground text-xs">
                            {stages.find((s) => s.key === ev.fromStageKey)?.name ?? ev.fromStageKey}
                            {" → "}
                            {stages.find((s) => s.key === ev.toStageKey)?.name ?? ev.toStageKey}
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground mt-0.5 text-xs">
                        {formatDistanceToNow(new Date(ev.createdAt), {
                          addSuffix: true,
                        })}
                        {ev.actorEmail ? ` · ${ev.actorEmail}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Side column */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.customer}</CardTitle>
          </CardHeader>
          <CardContent>
            {order.customer ? (
              <div className="space-y-1 text-sm">
                <div className="font-medium">{order.customer.name}</div>
                {order.customer.email && (
                  <a
                    href={`mailto:${order.customer.email}`}
                    className="text-primary-text hover:underline"
                  >
                    {order.customer.email}
                  </a>
                )}
                {order.customer.phone && (
                  <a
                    href={`tel:${order.customer.phone.replace(/\s+/g, "")}`}
                    className="text-muted-foreground block hover:underline"
                  >
                    {order.customer.phone}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{labels.noCustomer}</p>
            )}
          </CardContent>
        </Card>

        {/* Linked extension record (e.g. the vehicle being serviced) — §13 */}
        {order.linkedRecord && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {order.linkedRecord.entityName}: {order.linkedRecord.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-1.5 text-sm">
                {Object.entries(order.linkedRecord.data)
                  .filter(([k, v]) => {
                    const f = order.linkedRecord?.fields.find((x) => x.key === k)
                    return v !== null && v !== undefined && v !== "" && f
                  })
                  .slice(0, 12)
                  .map(([k, v]) => {
                    const f = order.linkedRecord?.fields.find((x) => x.key === k)
                    return (
                      <div key={k} className="flex justify-between gap-3">
                        <dt className="text-muted-foreground text-xs">
                          {f?.label ?? k}
                          {f?.unit ? ` (${f.unit})` : ""}
                        </dt>
                        <dd className="font-medium">{String(v)}</dd>
                      </div>
                    )
                  })}
              </dl>
              <Link
                href="/dashboard/records"
                className="text-primary-text mt-3 inline-block text-xs hover:underline"
              >
                {recordsLinkLabel}
              </Link>
            </CardContent>
          </Card>
        )}

        {order.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{labels.notes}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">
                {order.notes}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
