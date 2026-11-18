"use client"

import { useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PlusIcon,
  MinusIcon,
  PrinterIcon,
} from "@/components/icons"
import {
  createDocument,
  updateDocument,
  deleteDocument,
  changeDocumentStatus,
  convertQuoteToInvoice,
  getDocumentDetail,
  getDocumentIssuerConfig,
  listDocumentCustomers,
  recordDocumentPayment,
  reverseDocumentPayment,
  issueCreditNote,
  listDocumentPayments,
  listDocumentCredits,
  archiveDocument,
  sendDocument,
  getDocumentArchiveMeta,
  applyAdvancesToInvoice,
  listApplicableAdvances,
  reverseAdvanceAllocation,
  getAdvanceHistory,
  type AdvanceRef,
  type AdvanceListItem,
  type AdvanceAllocationHistoryRow,
  type DocumentListItem,
  type DocumentDetail,
  type DocumentType,
  type DocumentPaymentInfo,
  type DocumentCreditInfo,
} from "@/app/actions/documents"
import type { CatalogDocsDict } from "@/lib/i18n/dict/catalog-docs"
import { formatCurrency } from "@/lib/utils/format"

// ============================================================
// DOCUMENTS MANAGER (client) — §13 quotes + invoices.
// Tabs per type, create dialog with free-form line items and a
// detail dialog with validated status transitions and a
// print-friendly layout (window.print with print-scoped CSS).
// ============================================================

type Labels = CatalogDocsDict["documents"]

interface DocumentsClientProps {
  quotes: DocumentListItem[]
  invoices: DocumentListItem[]
  advances: AdvanceListItem[]
  openWorkOrders: { id: string; number: number; title: string }[]
  openOrders: { id: string; label: string }[]
  appointments: { id: string; startTime: string; customerName: string | null }[]
  labels: Labels
}

interface LineDraft {
  description: string
  quantity: number
  unitPrice: number
  discountPercent: number
  vatRate: number
}

const emptyForm = {
  customerId: "",
  workOrderId: "",
  orderId: "",
  appointmentId: "",
  issueDate: format(new Date(), "yyyy-MM-dd"),
  dueDate: "",
  // F5.5.4.5 — datum/obdobje opravljene storitve.
  serviceDate: "",
  servicePeriodStart: "",
  servicePeriodEnd: "",
  notes: "",
  lines: [
    { description: "", quantity: 1, unitPrice: 0, discountPercent: 0, vatRate: 0 },
  ] as LineDraft[],
}

const quoteStatusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-primary/10 text-primary-text",
  ACCEPTED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

const invoiceStatusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ISSUED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  CANCELLED: "bg-muted text-muted-foreground line-through",
}

const advanceStatusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ISSUED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  PARTIALLY_PAID: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
  PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  CANCELLED: "bg-muted text-muted-foreground line-through",
}

function money(n: number): string {
  // P1 #7 (walkthrough): enoten format valute — "79,02 €", ne "€79.02"
  return formatCurrency(n)
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("sl-SI", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function docCode(type: DocumentType, n: number): string {
  if (type === "QUOTE") return `PON-${String(n).padStart(4, "0")}`
  if (type === "ADVANCE") return `AVN-${String(n).padStart(4, "0")}`
  return `RAC-${String(n).padStart(4, "0")}`
}

export function DocumentsClient({
  quotes,
  invoices,
  advances,
  openWorkOrders,
  openOrders,
  appointments,
  labels,
}: DocumentsClientProps) {
  const router = useRouter()
  const [tab, setTab] = useState<DocumentType>("QUOTE")
  const [createOpen, setCreateOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [customers, setCustomers] = useState<
    { id: string; name: string; email: string | null }[]
  >([])
  const [vatEnabled, setVatEnabled] = useState(false)
  const [editing, setEditing] = useState<DocumentDetail | null>(null)
  const [form, setForm] = useState(emptyForm)

  // Detail dialog state
  const [detail, setDetail] = useState<DocumentDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const list =
    tab === "QUOTE" ? quotes : tab === "ADVANCE" ? advances : invoices
  const advanceList: AdvanceListItem[] = tab === "ADVANCE" ? advances : []
  const docList: DocumentListItem[] =
    tab === "QUOTE" ? quotes : tab === "ADVANCE" ? [] : invoices
  const statusLabels: Record<string, string> =
    tab === "QUOTE"
      ? labels.quoteStatusLabels
      : tab === "ADVANCE"
        ? labels.advanceStatusLabels
        : labels.invoiceStatusLabels
  const statusColors =
    tab === "QUOTE"
      ? quoteStatusColors
      : tab === "ADVANCE"
        ? advanceStatusColors
        : invoiceStatusColors

  // Analogni predogled skupnega zneska (bruto po linijah; DDV prikažemo,
  // ko org ni DDV zavezanec, pa so zneski brez davka).
  const linesTotal = form.lines.reduce((s, l) => {
    const gross = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)
    const afterDiscount = gross * (1 - (Number(l.discountPercent) || 0) / 100)
    return s + afterDiscount
  }, 0)

  const loadIssuerConfig = async () => {
    try {
      const cfg = await getDocumentIssuerConfig()
      setVatEnabled(cfg.isVatRegistered)
    } catch {
      setVatEnabled(false)
    }
  }

  const openCreate = async () => {
    setEditing(null)
    setForm(emptyForm)
    setCreateOpen(true)
    if (customers.length === 0) {
      try {
        setCustomers(await listDocumentCustomers())
      } catch {
        // non-fatal: document can be created without a customer
      }
    }
    await loadIssuerConfig()
  }

  // Uredi DRAFT — napolni obrazec iz obstoječega dokumenta.
  const openEdit = (d: DocumentDetail) => {
    setEditing(d)
    setForm({
      customerId: d.customer?.id ?? "",
      workOrderId: d.workOrder?.id ?? "",
      orderId: d.order?.id ?? "",
      appointmentId: d.appointment?.id ?? "",
      issueDate: d.issueDate.slice(0, 10),
      dueDate: d.dueDate ? d.dueDate.slice(0, 10) : "",
      serviceDate: d.serviceDate ? d.serviceDate.slice(0, 10) : "",
      servicePeriodStart: d.servicePeriod ? d.servicePeriod.slice(0, 10) : "",
      servicePeriodEnd: d.servicePeriod ? d.servicePeriod.slice(0, 10) : "",
      notes: d.notes ?? "",
      lines: d.items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountPercent: it.discountPercent,
        vatRate: it.vatRate,
      })),
    })
    setCreateOpen(true)
    setEditing(d)
  }

  const openDetail = async (id: string) => {
    setDetailOpen(true)
    setDetail(null)
    setPayments([]); setCredits([])
    try {
      const d = await getDocumentDetail(id)
      setDetail(d)
      void refreshLedger(id)
      void loadArchiveMeta(id)
      if (d && d.type === "INVOICE") {
        setApplicableAdvances([])
        void loadAdvances(id)
      } else {
        setApplicableAdvances([])
      }
      if (d && d.type === "ADVANCE") {
        void loadAdvanceHistory(id)
      } else {
        setAdvanceHistory([])
        setAdvanceReversals([])
      }
    } catch {
      toast.error(labels.errors.NOT_FOUND)
      setDetailOpen(false)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const items = form.lines
      .filter((l) => l.description.trim())
      .map((l) => ({
        description: l.description,
        quantity: Number(l.quantity) || 0,
        unitPrice: Number(l.unitPrice) || 0,
        discountPercent: Number(l.discountPercent) || 0,
        vatRate: Number(l.vatRate) || 0,
      }))
    if (items.length === 0) {
      toast.error(labels.errors.NO_ITEMS)
      return
    }
    const payload = {
      type: tab as DocumentType,
      customerId: form.customerId || null,
      workOrderId: form.workOrderId || null,
      orderId: form.orderId || null,
      appointmentId: form.appointmentId || null,
      issueDate: form.issueDate || null,
      dueDate: form.dueDate || null,
      serviceDate: form.serviceDate || null,
      servicePeriodStart: form.servicePeriodStart || null,
      servicePeriodEnd: form.servicePeriodEnd || null,
      notes: form.notes || null,
      items,
    }
    startTransition(async () => {
      const result = editing ? await updateDocument(editing.id, payload) : await createDocument(payload)
      if (result.ok) {
        toast.success(editing ? labels.detail.statusChanged : labels.create.created)
        setCreateOpen(false)
        setEditing(null)
        setForm(emptyForm)
        router.refresh()
      } else {
        toast.error(errorText(result.error))
      }
    })
  }

  const removeDoc = (d: DocumentDetail) => {
    if (!window.confirm(labels.detail.promptDelete ?? "Izbrisati osnutek?")) return
    startTransition(async () => {
      const result = await deleteDocument(d.id)
      if (result.ok) {
        toast.success(labels.detail.statusChanged)
        setDetailOpen(false)
        router.refresh()
      } else {
        toast.error(errorText(result.error))
      }
    })
  }

  // ---- F5.5.4.2: plačila + dobropisi (podatki se naložijo v openDetail) ----
  const [payments, setPayments] = useState<DocumentPaymentInfo[]>([])
  const [credits, setCredits] = useState<DocumentCreditInfo[]>([])
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState("cash")
  const [payRef, setPayRef] = useState("")
  const [creditAmount, setCreditAmount] = useState("")
  const [ledgerBusy, setLedgerBusy] = useState(false)
  // F5.5.4.5: avansi
  const [applicableAdvances, setApplicableAdvances] = useState<AdvanceRef[]>([])
  const [selectedAdvances, setSelectedAdvances] = useState<string[]>([])
  const [advBusy, setAdvBusy] = useState(false)
  // F5.5.4.5.2: zgodovina uporabe/storniranja avansa + razlog preklica
  const [advanceHistory, setAdvanceHistory] = useState<AdvanceAllocationHistoryRow[]>([])
  const [advanceReversals, setAdvanceReversals] = useState<{ paymentAmount: number; paidAt: string }[]>([])
  const [revokeReason, setRevokeReason] = useState("")
  // F5.5.4.3: arhiv + pošiljanje
  const [archived, setArchived] = useState(false)
  const [archiveSha, setArchiveSha] = useState<string | null>(null)
  const [archiveName, setArchiveName] = useState<string | null>(null)
  const [archiveId, setArchiveId] = useState<string | null>(null)
  const [toEmail, setToEmail] = useState("")
  const [busy, setBusy2] = useState(false)

  const loadArchiveMeta = async (docId: string) => {
    const m = await getDocumentArchiveMeta(docId)
    setArchived(!!m?.archived)
    setArchiveSha(m?.sha256 ?? null)
    setArchiveName(m?.filename ?? null)
    setArchiveId(m?.id ?? null)
  }

  const doArchive = async (docId: string) => {
    setBusy2(true)
    try {
      const r = await archiveDocument(docId)
      if (!r.ok && !r.alreadyArchived) return toast.error(errorText(r.error ?? "ARCHIVE_FAILED"))
      toast.success(r.alreadyArchived ? "Dokument je že arhiviran." : "Dokument je arhiviran.")
      setArchived(true); setArchiveSha(r.sha256 ?? null); setArchiveName(r.filename ?? null); setArchiveId(r.id ?? null)
    } finally { setBusy2(false) }
  }

  const doDownload = () => {
    // Prenos prek zaščitene rute (org-scoped, IDOR), nikoli javni URL.
    if (!archiveId) return
    const link = document.createElement("a")
    link.href = `/api/documents/archive/${archiveId}`
    link.download = archiveName ?? "dokument.pdf"
    link.click()
  }

  const doSend = async (docId: string) => {
    if (!toEmail.includes("@")) return toast.error("Vnesite veljaven e-poštni naslov prejemnika.")
    setBusy2(true)
    try {
      const r = await sendDocument(docId, { toEmail })
      if (r.status === "UNSENT") return toast.error("E-poštni ponudnik ni konfiguriran — sporočilo NI poslano.")
      if (!r.ok) return toast.error(errorText(r.error ?? "SEND_FAILED"))
      toast.success("Dokument je bil poslan.")
      setToEmail("")
    } finally { setBusy2(false) }
  }

  const refreshLedger = async (docId: string) => {
    if (!docId) return
    setPayments((await listDocumentPayments(docId)) ?? [])
    setCredits((await listDocumentCredits(docId)) ?? [])
  }

  const bookPayment = async (docId: string) => {
    const amount = Number(payAmount)
    if (!amount || amount <= 0) return toast.error("Vnesite znesek plačila.")
    setLedgerBusy(true)
    try {
      const res = await recordDocumentPayment(docId, {
        amount,
        method: payMethod || null,
        reference: payRef || null,
      })
      if (!res.ok) return toast.error(errorText(res.error))
      toast.success("Plačilo je vknjiženo.")
      setPayAmount(""); setPayRef("")
      const fresh = await getDocumentDetail(docId)
      if (fresh) setDetail(fresh)
      await refreshLedger(docId)
      router.refresh()
    } finally {
      setLedgerBusy(false)
    }
  }

  const stornoPayment = async (docId: string, paymentId: string) => {
    if (!window.confirm("Stornirati to plačilo? (ostane sled v knjigi)")) return
    setLedgerBusy(true)
    try {
      const res = await reverseDocumentPayment(docId, paymentId)
      if (!res.ok) return toast.error(errorText(res.error))
      toast.success("Plačilo je stornirano.")
      const fresh = await getDocumentDetail(docId)
      if (fresh) setDetail(fresh)
      await refreshLedger(docId)
      router.refresh()
    } finally {
      setLedgerBusy(false)
    }
  }

  const bookCredit = async (docId: string) => {
    const amount = Number(creditAmount)
    if (!amount || amount <= 0) return toast.error("Vnesite znesek dobropisa.")
    setLedgerBusy(true)
    try {
      const res = await issueCreditNote(docId, { amount })
      if (!res.ok) return toast.error(errorText(res.error))
      toast.success("Dobropis je izdan.")
      setCreditAmount("")
      const fresh = await getDocumentDetail(docId)
      if (fresh) setDetail(fresh)
      await refreshLedger(docId)
      router.refresh()
    } finally {
      setLedgerBusy(false)
    }
  }

  // F5.5.4.5 — aplikacija izbranih avansov na končni račun.
  const loadAdvances = async (invoiceId: string) => {
    try {
      setApplicableAdvances((await listApplicableAdvances(invoiceId)) ?? [])
    } catch {
      setApplicableAdvances([])
    }
  }
  const applyAdvances = async (invoiceId: string) => {
    if (!selectedAdvances.length) return
    setAdvBusy(true)
    try {
      const res = await applyAdvancesToInvoice(invoiceId, { advanceIds: selectedAdvances })
      if (!res.ok) return toast.error(errorText(res.error))
      toast.success(`Apliciranih avansov: ${res.allocations?.length ?? 0}`)
      setSelectedAdvances([])
      const fresh = await getDocumentDetail(invoiceId)
      if (fresh) setDetail(fresh)
      await refreshLedger(invoiceId)
      await loadAdvances(invoiceId)
      router.refresh()
    } finally {
      setAdvBusy(false)
    }
  }

  // F5.5.4.5.2 — naloži zgodovino uporabe/storniranja avansa.
  const loadAdvanceHistory = async (advanceId: string) => {
    try {
      const h = await getAdvanceHistory(advanceId)
      setAdvanceHistory(h?.allocations ?? [])
      setAdvanceReversals(h?.reversals ?? [])
    } catch {
      setAdvanceHistory([])
      setAdvanceReversals([])
    }
  }

  // F5.5.4.5.2 — preklic uporabe avansa (storno). Ostane sled v zgodovini.
  const revokeAdvance = async (invoiceId: string, advanceId: string) => {
    if (!window.confirm(labels.detail.advanceRevokeConfirm ?? "Preklicati uporabo tega avansa?")) return
    setAdvBusy(true)
    try {
      const res = await reverseAdvanceAllocation(invoiceId, advanceId, revokeReason.trim() || undefined)
      if (!res.ok) return toast.error(errorText(res.error))
      toast.success("Uporaba avansa je preklicana.")
      setRevokeReason("")
      const fresh = await getDocumentDetail(advanceId)
      if (fresh) setDetail(fresh)
      await loadAdvanceHistory(advanceId)
      router.refresh()
    } finally {
      setAdvBusy(false)
    }
  }

  const changeStatus = (id: string, status: string) => {
    startTransition(async () => {
      const result = await changeDocumentStatus(id, status)
      if (result.ok) {
        toast.success(labels.detail.statusChanged)
        const fresh = await getDocumentDetail(id)
        setDetail(fresh)
        router.refresh()
      } else {
        toast.error(errorText(result.error))
      }
    })
  }

  const convert = (id: string) => {
    startTransition(async () => {
      const result = await convertQuoteToInvoice(id)
      if (result.ok) {
        toast.success(labels.detail.converted)
        setDetailOpen(false)
        setTab("INVOICE")
        router.refresh()
      } else {
        toast.error(
          result.error === "NOT_ACCEPTED"
            ? labels.detail.notAccepted
            : errorText(result.error)
        )
      }
    })
  }

  const errorText = (code?: string) => {
    const map: Record<string, string> = {
      INVALID_TYPE: labels.errors.INVALID_TYPE,
      NO_ITEMS: labels.errors.NO_ITEMS,
      EMPTY_LINE: labels.errors.EMPTY_LINE,
      INVALID_QUANTITY: labels.errors.INVALID_QUANTITY,
      INVALID_PRICE: labels.errors.INVALID_PRICE,
      NOT_FOUND: labels.errors.NOT_FOUND,
      INVALID_TRANSITION: labels.errors.INVALID_TRANSITION,
      NOT_ACCEPTED: labels.errors.NOT_ACCEPTED,
      LOCKED_AFTER_ISSUE: "Izdanega dokumenta ni več mogoče urejati.",
      INVOICE_NEEDS_CUSTOMER: "Račun mora imeti izbrano stranko.",
      NOT_FOUND_CUSTOMER: labels.errors.NOT_FOUND,
      NOT_FOUND_WORKORDER: labels.errors.NOT_FOUND,
      NOT_FOUND_ORDER: labels.errors.NOT_FOUND,
      NOT_FOUND_APPOINTMENT: labels.errors.NOT_FOUND,
      NOT_PAYABLE: "Za ta dokument ni mogoče knjižiti plačila.",
      INVALID_AMOUNT: "Neveljaven znesek.",
      OVERPAYMENT: "Znesek presega odprto stanje računa.",
      DUPLICATE_PAYMENT: "Plačilo s tem sklicem je že vknjiženo.",
      NOT_FOUND_PAYMENT: "Plačilo ni najdeno.",
      ALREADY_REVERSED: "Plačilo je že stornirano.",
      CREDIT_EXCEEDS_ALLOWED: "Dobropis presega dovoljeni preostali znesek.",
      NOT_ISSUED: "Dokument ni izdan.",
      NOT_AVAILABLE: "Za dokument ni podatkov za PDF.",
      NOT_ARCHIVED: "Dokument ni arhiviran — najprej arhivirajte.",
      INVALID_EMAIL: "Neveljaven e-poštni naslov prejemnika.",
      ARCHIVE_FAILED: "Arhiviranje ni uspelo.",
      SEND_FAILED: "Pošiljanje ni uspelo.",
    }
    return (code && map[code]) || labels.errors.GENERIC
  }

  const quoteActions = useMemo(() => {
    if (!detail) return null
    if (detail.type !== "QUOTE") return null
    const s = detail.status
    return (
      <div className="flex flex-wrap gap-2">
        {s === "DRAFT" && (
          <>
            <Button size="sm" onClick={() => changeStatus(detail.id, "SENT")}>
              {labels.detail.send}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => changeStatus(detail.id, "REJECTED")}
            >
              {labels.detail.reject}
            </Button>
            <Button size="sm" variant="outline" onClick={() => openEdit(detail)}>
              {labels.detail.edit ?? "Uredi"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => removeDoc(detail)}>
              {labels.detail.delete ?? "Izbriši"}
            </Button>
          </>
        )}
        {s === "SENT" && (
          <>
            <Button size="sm" onClick={() => changeStatus(detail.id, "ACCEPTED")}>
              {labels.detail.accept}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => changeStatus(detail.id, "REJECTED")}
            >
              {labels.detail.reject}
            </Button>
          </>
        )}
        {s === "ACCEPTED" && (
          <Button size="sm" onClick={() => convert(detail.id)}>
            {labels.detail.convert}
          </Button>
        )}
      </div>
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail])

  const invoiceActions = useMemo(() => {
    if (!detail || detail.type !== "INVOICE") return null
    const s = detail.status
    return (
      <div className="flex flex-wrap gap-2">
        {s === "DRAFT" && (
          <>
            <Button size="sm" onClick={() => changeStatus(detail.id, "ISSUED")}>
              {labels.detail.issue}
            </Button>
            <Button size="sm" variant="outline" onClick={() => openEdit(detail)}>
              {labels.detail.edit ?? "Uredi"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => removeDoc(detail)}>
              {labels.detail.delete ?? "Izbriši"}
            </Button>
          </>
        )}
        {s === "ISSUED" && (
          <Button size="sm" onClick={() => changeStatus(detail.id, "PAID")}>
            {labels.detail.markPaid}
          </Button>
        )}
        {(s === "DRAFT" || s === "ISSUED") && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => changeStatus(detail.id, "CANCELLED")}
          >
            {labels.detail.cancel}
          </Button>
        )}
      </div>
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail])

  return (
    <Card className="print:hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {(["QUOTE", "INVOICE", "ADVANCE"] as DocumentType[]).map((tt) => (
            <button
              key={tt}
              onClick={() => setTab(tt)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === tt
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tt === "QUOTE"
                ? labels.tabQuotes
                : tt === "ADVANCE"
                  ? labels.tabAdvances
                  : labels.tabInvoices}
              <span className="text-muted-foreground ml-1.5 text-xs">
                {(tt === "QUOTE" ? quotes.length : tt === "ADVANCE" ? advances.length : invoices.length)}
              </span>
            </button>
          ))}
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <PlusIcon size={16} className="mr-2" />
              {tab === "QUOTE"
                ? labels.newQuote
                : tab === "ADVANCE"
                  ? labels.newAdvance
                  : labels.newInvoice}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <form onSubmit={submit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>
                  {editing
                    ? labels.detail.edit ?? "Uredi dokument"
                    : tab === "QUOTE"
                      ? labels.create.titleQuote
                      : tab === "ADVANCE"
                        ? labels.create.titleAdvance
                        : labels.create.titleInvoice}
                </DialogTitle>
                <DialogDescription>{labels.create.description}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-customer">{labels.create.customerLabel}</Label>
                  <Select
                    value={form.customerId || "none"}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, customerId: v === "none" ? "" : v }))
                    }
                  >
                    <SelectTrigger id="doc-customer">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-wo">{labels.create.workOrderLabel}</Label>
                  <Select
                    value={form.workOrderId || "none"}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, workOrderId: v === "none" ? "" : v }))
                    }
                  >
                    <SelectTrigger id="doc-wo">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {openWorkOrders.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          #{String(w.number).padStart(3, "0")} · {w.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-order">Naročilo</Label>
                  <Select
                    value={form.orderId || "none"}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, orderId: v === "none" ? "" : v }))
                    }
                  >
                    <SelectTrigger id="doc-order">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {openOrders.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-appt">Termin</Label>
                  <Select
                    value={form.appointmentId || "none"}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, appointmentId: v === "none" ? "" : v }))
                    }
                  >
                    <SelectTrigger id="doc-appt">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {appointments.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {formatDate(a.startTime)}
                          {a.customerName ? ` · ${a.customerName}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-issue">{labels.create.issueDateLabel}</Label>
                  <Input
                    id="doc-issue"
                    type="date"
                    value={form.issueDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, issueDate: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-due">{labels.create.dueDateLabel}</Label>
                  <Input
                    id="doc-due"
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  />
                </div>

                {/* F5.5.4.5 — datum / obdobje opravljene storitve (ločeno od izdaje).
                    Prazno = ni določeno (ostane null). */}
                <div className="space-y-1.5">
                  <Label htmlFor="doc-service">Datum opravljene storitve</Label>
                  <Input
                    id="doc-service"
                    type="date"
                    value={form.serviceDate}
                    onChange={(e) => setForm((f) => ({ ...f, serviceDate: e.target.value, servicePeriodStart: "", servicePeriodEnd: "" }))}
                  />
                </div>
                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Obdobje od</Label>
                    <Input type="date" value={form.servicePeriodStart} onChange={(e) => setForm((f) => ({ ...f, servicePeriodStart: e.target.value, serviceDate: "" }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>do</Label>
                    <Input type="date" value={form.servicePeriodEnd} onChange={(e) => setForm((f) => ({ ...f, servicePeriodEnd: e.target.value, serviceDate: "" }))} />
                  </div>
                </div>
              </div>

              {/* Line items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{labels.create.linesTitle} *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        lines: [
                          ...f.lines,
                          { description: "", quantity: 1, unitPrice: 0, discountPercent: 0, vatRate: vatEnabled ? 22 : 0 },
                        ],
                      }))
                    }
                  >
                    <PlusIcon size={14} className="mr-1" />
                    {labels.create.addLine}
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_60px_80px_56px_72px_40px] items-center gap-2">
                      <Input
                        value={line.description}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, i) =>
                              i === idx ? { ...l, description: e.target.value } : l
                            ),
                          }))
                        }
                        placeholder={labels.create.lineDescriptionPlaceholder}
                        aria-label={labels.create.lineDescription}
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, i) =>
                              i === idx ? { ...l, quantity: Number(e.target.value) } : l
                            ),
                          }))
                        }
                        aria-label={labels.create.lineQuantity}
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, i) =>
                              i === idx ? { ...l, unitPrice: Number(e.target.value) } : l
                            ),
                          }))
                        }
                        aria-label={labels.create.lineUnitPrice}
                      />
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={line.discountPercent}
                        placeholder="%"
                        title={labels.create.lineDiscount}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, i) =>
                              i === idx ? { ...l, discountPercent: Number(e.target.value) } : l
                            ),
                          }))
                        }
                        aria-label={labels.create.lineDiscount}
                      />
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={line.vatRate}
                        placeholder="DDV %"
                        title={labels.create.lineVat}
                        disabled={!vatEnabled}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, i) =>
                              i === idx ? { ...l, vatRate: Number(e.target.value) } : l
                            ),
                          }))
                        }
                        aria-label={labels.create.lineVat}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive"
                        disabled={form.lines.length === 1}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        <MinusIcon size={14} />
                        <span className="sr-only">{labels.create.removeLine}</span>
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="text-right text-sm font-medium">
                  {labels.total}: {money(linesTotal)}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="doc-notes">{labels.create.notesLabel}</Label>
                <Textarea
                  id="doc-notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Prekliči
                </Button>
                <Button type="submit" disabled={pending}>
                  {labels.create.submit}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-medium">{labels.empty}</p>
            <p className="text-muted-foreground mt-1 text-sm">{labels.emptyHint}</p>
          </div>
        ) : tab === "ADVANCE" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                  <th className="px-2 py-3">{labels.number}</th>
                  <th className="hidden px-2 py-3 md:table-cell">{labels.customer}</th>
                  <th className="hidden px-2 py-3 sm:table-cell">{labels.issueDate}</th>
                  <th className="px-2 py-3">{labels.detail.advanceReceived}</th>
                  <th className="px-2 py-3">{labels.detail.advanceUsed}</th>
                  <th className="px-2 py-3">{labels.detail.advanceUnused}</th>
                  <th className="hidden px-2 py-3 lg:table-cell">{labels.detail.advanceLinkedTo}</th>
                  <th className="px-2 py-3">{labels.status}</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {advanceList.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-muted/50 border-b transition-colors last:border-0"
                  >
                    <td className="px-2 py-3 font-mono text-xs">{d.docCode}</td>
                    <td className="hidden max-w-44 truncate px-2 py-3 md:table-cell">
                      {d.customerName ?? (
                        <span className="text-muted-foreground">{labels.noCustomer}</span>
                      )}
                    </td>
                    <td className="hidden px-2 py-3 text-xs sm:table-cell">
                      {formatDate(d.issueDate)}
                    </td>
                    <td className="px-2 py-3 font-medium">{money(d.received)}</td>
                    <td className="px-2 py-3 text-muted-foreground">{money(d.used)}</td>
                    <td className="px-2 py-3 font-medium">{money(d.unused)}</td>
                    <td className="hidden max-w-44 truncate px-2 py-3 lg:table-cell">
                      {d.parentInvoiceCode ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {d.parentInvoiceCode}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusColors[d.status] ?? ""
                        }`}
                      >
                        {statusLabels[d.status] ?? d.status}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(d.id)}>
                        {labels.detail.title}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                  <th className="px-2 py-3">{labels.number}</th>
                  <th className="hidden px-2 py-3 md:table-cell">{labels.customer}</th>
                  <th className="hidden px-2 py-3 lg:table-cell">{labels.workOrder}</th>
                  <th className="hidden px-2 py-3 sm:table-cell">{labels.issueDate}</th>
                  <th className="hidden px-2 py-3 sm:table-cell">{labels.dueDate}</th>
                  <th className="px-2 py-3">{labels.total}</th>
                  <th className="px-2 py-3">{labels.status}</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {docList.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-muted/50 border-b transition-colors last:border-0"
                  >
                    <td className="px-2 py-3 font-mono text-xs">
                      {d.docCode}
                      {d.overdue && (
                        <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          {labels.overdue}
                        </span>
                      )}
                    </td>
                    <td className="hidden max-w-44 truncate px-2 py-3 md:table-cell">
                      {d.customerName ?? (
                        <span className="text-muted-foreground">{labels.noCustomer}</span>
                      )}
                    </td>
                    <td className="hidden max-w-44 truncate px-2 py-3 lg:table-cell">
                      {d.workOrderId ? (
                        <span className="text-muted-foreground text-xs">
                          #{String(d.workOrderNumber).padStart(3, "0")} · {d.workOrderTitle}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="hidden px-2 py-3 text-xs sm:table-cell">
                      {formatDate(d.issueDate)}
                    </td>
                    <td className="hidden px-2 py-3 text-xs sm:table-cell">
                      {formatDate(d.dueDate)}
                    </td>
                    <td className="px-2 py-3 font-medium">{money(d.total)}</td>
                    <td className="px-2 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusColors[d.status] ?? ""
                        }`}
                      >
                        {statusLabels[d.status] ?? d.status}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(d.id)}>
                        {labels.detail.title}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {detail ? (
            <>
              {/* Printable area */}
              <div className="print-area">
                <DialogHeader className="print:hidden">
                  <DialogTitle className="flex items-center gap-2">
                    {detail.type === "QUOTE"
                      ? labels.detail.quoteLabel
                      : detail.type === "ADVANCE"
                        ? labels.detail.advanceLabel
                        : labels.detail.invoiceLabel}{" "}
                    {docCode(detail.type, detail.number)}
                  </DialogTitle>
                  <DialogDescription>{labels.detail.printHint}</DialogDescription>
                </DialogHeader>

                <div className="mt-2 space-y-4">
                  {/* Izdajatelj (iz nespremenljivega posnetka za izdane) */}
                  <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
                    <div>
                      <div className="font-semibold">{detail.issuer?.name ?? "—"}</div>
                      {detail.issuer?.vatId && (
                        <div className="text-muted-foreground text-xs">
                          ID za DDV: {detail.issuer.vatId}
                        </div>
                      )}
                      {detail.issuer?.registrationNumber && (
                        <div className="text-muted-foreground text-xs">
                          Matična: {detail.issuer.registrationNumber}
                        </div>
                      )}
                      {detail.issuer?.bankAccount && (
                        <div className="text-muted-foreground text-xs">
                          TRR: {detail.issuer.bankAccount}
                        </div>
                      )}
                      {detail.issuer?.email && (
                        <div className="text-muted-foreground text-xs">{detail.issuer.email}</div>
                      )}
                      {detail.issuer?.street && (
                        <div className="text-muted-foreground text-xs">
                          {detail.issuer.street}
                          {detail.issuer.zip ? `, ${detail.issuer.zip}` : ""}
                          {detail.issuer.city ? ` ${detail.issuer.city}` : ""}
                        </div>
                      )}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {detail.type === "QUOTE"
                        ? labels.detail.quoteLabel
                        : detail.type === "ADVANCE"
                          ? labels.detail.advanceLabel
                          : labels.detail.invoiceLabel}
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <div className="text-muted-foreground text-xs uppercase">
                        {detail.type === "QUOTE" ? labels.detail.validUntil : labels.detail.paymentDue}
                      </div>
                      <div>{formatDate(detail.dueDate)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs uppercase">
                        {labels.detail.billTo}
                      </div>
                      <div className="font-medium">{detail.customer?.name ?? labels.noCustomer}</div>
                      {detail.customer?.email && (
                        <div className="text-muted-foreground text-xs">{detail.customer.email}</div>
                      )}
                      {detail.customer?.phone && (
                        <div className="text-muted-foreground text-xs">{detail.customer.phone}</div>
                      )}
                    </div>
                  </div>

                  {detail.workOrder && (
                    <div className="bg-muted/50 rounded-lg p-3 text-sm">
                      <span className="text-muted-foreground text-xs uppercase">
                        {labels.detail.linkedOrder}
                      </span>
                      <div className="font-medium">
                        #{String(detail.workOrder.number).padStart(3, "0")} ·{" "}
                        {detail.workOrder.title}
                      </div>
                    </div>
                  )}

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                        <th className="py-2">{labels.create.lineDescription}</th>
                        <th className="py-2 text-right">{labels.create.lineQuantity}</th>
                        <th className="py-2 text-right">{labels.create.lineUnitPrice}</th>
                        <th className="py-2 text-right">{labels.create.lineTotal}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map((it) => (
                        <tr key={it.id} className="border-b last:border-0">
                          <td className="py-2">{it.description}</td>
                          <td className="py-2 text-right">{it.quantity}</td>
                          <td className="py-2 text-right">{money(it.unitPrice)}</td>
                          <td className="py-2 text-right font-medium">{money(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      {detail.totals.discountAmount > 0 && (
                        <tr>
                          <td colSpan={3} className="py-1 text-right text-muted-foreground">
                            Popust
                          </td>
                          <td className="py-1 text-right">−{money(detail.totals.discountAmount)}</td>
                        </tr>
                      )}
                      {detail.totals.vatEnabled && (
                        <tr>
                          <td colSpan={3} className="py-1 text-right text-muted-foreground">
                            Osnova za DDV
                          </td>
                          <td className="py-1 text-right">{money(detail.totals.taxBase)}</td>
                        </tr>
                      )}
                      {detail.totals.vatEnabled && (
                        <tr>
                          <td colSpan={3} className="py-1 text-right text-muted-foreground">
                            DDV (WW: {detail.totals.currency})
                          </td>
                          <td className="py-1 text-right">{money(detail.totals.taxTotal)}</td>
                        </tr>
                      )}
                      <tr>
                        <td colSpan={3} className="py-2 text-right font-semibold">
                          {labels.detail.subtotalLabel}
                        </td>
                        <td className="py-2 text-right text-base font-bold text-primary-text">
                          {money(detail.totals.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  {detail.notes && (
                    <div className="text-sm">
                      <div className="text-muted-foreground text-xs uppercase">{labels.detail.notes}</div>
                      <div className="whitespace-pre-line">{detail.notes}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* F5.5.4.2: plačila in dobropisi */}
              <div className="print:hidden mt-2 space-y-3 border-t pt-3">
                {/* F5.5.4.5.2: pregled avansnega računa — prejeto/uporabljeno/ostank + povezava + zgodovina */}
                {detail.type === "ADVANCE" && detail.status !== "DRAFT" && (
                  <>
                    <div className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div className="font-semibold">{labels.detail.advanceLabel}</div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {(() => {
                            // F5.5.4.5.2 — "used" na AVANSU je vsota AKTIVNIH alokacij
                            // iz zgodovine (detail.advanceTotal je na ADVANCE vedno 0 —
                            // piše se na končnem računu, zato ga tukaj NE smemo brati).
                            const used = advanceHistory
                              .filter((h) => h.status === "ACTIVE")
                              .reduce((s, h) => s + h.amount, 0)
                            const received = detail.paidAmount ?? 0
                            const unused = Math.max(0, Math.round((received - used) * 100) / 100)
                            return (
                              <>
                                <span className="text-muted-foreground">
                                  {labels.detail.advanceReceived} {money(received)}
                                </span>
                                <span className="text-muted-foreground">
                                  {labels.detail.advanceUsed} {money(used)}
                                </span>
                                <span className="font-medium">
                                  {labels.detail.advanceUnused} {money(unused)}
                                </span>
                              </>
                            )
                          })()}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-2 text-xs">
                        <div>
                          {(() => {
                            const actives = advanceHistory.filter((h) => h.status === "ACTIVE")
                            return actives.length > 0 ? (
                              <>
                                <span className="font-medium">{labels.detail.advanceLinkedTo}:</span>{" "}
                                {actives.map((r) => (
                                  <span key={r.id} className="mr-1 rounded bg-muted px-1.5 py-0.5 font-mono">
                                    {r.invoiceCode} · {money(r.amount)}
                                  </span>
                                ))}
                              </>
                            ) : (
                              <span className="text-muted-foreground">{labels.detail.advanceNotLinked}</span>
                            )
                          })()}
                        </div>
                        {(() => {
                          const actives = advanceHistory.filter((h) => h.status === "ACTIVE")
                          return actives.length > 0 && detail.status !== "CANCELLED" ? (
                            <div className="flex items-center gap-2">
                              <input
                                value={revokeReason}
                                onChange={(e) => setRevokeReason(e.target.value)}
                                placeholder={labels.detail.advanceRevokeReasonPlaceholder}
                                className="h-8 w-48 rounded-md border px-2 text-xs"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={advBusy}
                                onClick={() => revokeAdvance(actives[0].appliedToInvoice, detail.id)}
                              >
                                {labels.detail.advanceRevoke}
                              </Button>
                            </div>
                          ) : null
                        })()}
                      </div>
                    </div>

                    {/* Zgodovina uporabe in storniranja */}
                    <div className="rounded-lg border p-3">
                      <div className="text-sm font-semibold">{labels.detail.advanceHistory}</div>
                      {advanceHistory.length === 0 ? (
                        <p className="text-muted-foreground py-2 text-xs">{labels.detail.advanceNoHistory}</p>
                      ) : (
                        <ul className="divide-y py-1 text-xs">
                          {advanceHistory.map((h) => (
                            <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                              <span>
                                {h.status === "ACTIVE" ? (
                                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                    {labels.detail.advanceAllocationActive}
                                  </span>
                                ) : (
                                  <span className="font-medium text-red-600 dark:text-red-400">
                                    {labels.detail.advanceAllocationRevoked}
                                  </span>
                                )}{" "}
                                · {labels.detail.advanceInvoice} {h.invoiceCode} · {money(h.amount)}
                                <span className="text-muted-foreground">
                                  {" "}(osnova {money(h.taxBase)} · DDV {money(h.taxTotal)})
                                </span>
                              </span>
                              <span className="text-right text-muted-foreground">
                                <div>
                                  {labels.detail.advanceAllocatedAt}: {formatDate(h.allocatedAt)}
                                </div>
                                {h.status === "REVOKED" && (
                                  <div>
                                    {labels.detail.advanceRevokedAt}: {formatDate(h.revokedAt)}
                                    {h.revokeReason ? ` · ${labels.detail.advanceRevokeReason}: ${h.revokeReason}` : ""}
                                  </div>
                                )}
                              </span>
                            </li>
                          ))}
                          {advanceReversals.map((rv, i) => (
                            <li key={`rev-${i}`} className="flex items-center justify-between gap-2 py-1.5 text-muted-foreground">
                              <span>
                                {labels.detail.advanceReverseRow}: {money(rv.paymentAmount)}
                              </span>
                              <span>{formatDate(rv.paidAt)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}

                {(detail.type === "INVOICE" || detail.type === "ADVANCE") && detail.status !== "DRAFT" && (
                  <>
                    <div className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div className="font-semibold">Plačila</div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs">Plačano {money(detail.paidAmount ?? 0)}</span>
                          <span className="text-muted-foreground text-xs">/ Dobropisi {money(detail.creditedTotal ?? 0)}</span>
                          <span className="font-medium text-xs">Odprto {money(detail.openAmount)}</span>
                        </div>
                      </div>
                      {payments.length === 0 ? (
                        <p className="text-muted-foreground py-2 text-xs">Ni plačil.</p>
                      ) : (
                        <ul className="divide-y py-1 text-xs">
                          {payments.map((p) => (
                            <li key={p.id} className="flex items-center justify-between py-1">
                              <span>
                                {p.kind === "REVERSAL" ? "Storno" : "Plačilo"} · {money(p.amount)} · {p.method ?? "—"}
                                {p.reference ? ` · ${p.reference}` : ""}
                              </span>
                              <span className="flex items-center gap-2">
                                <span className="text-muted-foreground">{new Date(p.paidAt).toLocaleDateString("sl-SI")}</span>
                                {p.kind === "PAYMENT" && detail.status !== "CANCELLED" && (
                                  <Button size="sm" variant="ghost" disabled={ledgerBusy} onClick={() => stornoPayment(detail.id, p.id)}>Storno</Button>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {detail.status !== "CANCELLED" && (
                        <div className="mt-2 flex flex-wrap items-end gap-2">
                          <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="Znesek €" className="h-9 w-24 rounded-md border px-2 text-sm" />
                          <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="h-9 rounded-md border px-2 text-sm">
                            <option value="cash">Gotovina</option>
                            <option value="card">Kartica</option>
                            <option value="transfer">Prenos</option>
                            <option value="online">Online</option>
                          </select>
                          <input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Sklic" className="h-9 w-32 rounded-md border px-2 text-sm" />
                          <Button size="sm" disabled={ledgerBusy} onClick={() => bookPayment(detail.id)}>Knjiži</Button>
                        </div>
                      )}
                    </div>

                    {/* F5.5.4.5 — aplikacija avansov na končni račun */}
                    {detail.type === "INVOICE" && (
                      <div className="rounded-lg border p-3">
                        <div className="flex items-center justify-between text-sm">
                          <div className="font-semibold">Avansi</div>
                          {detail.advanceTotal > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Že aplicirano: {money(detail.advanceTotal)} · preostalo za plačilo: {money(detail.openAmount)}
                            </span>
                          )}
                        </div>
                        {detail.advanceRefs.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1 text-xs">
                            {detail.advanceRefs.map((r) => (
                              <span key={r.id} className="rounded bg-muted px-1.5 py-0.5 font-mono">{r.docCode} · {money(r.amount)}</span>
                            ))}
                          </div>
                        )}
                        {detail.status !== "CANCELLED" && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <select
                              multiple
                              value={selectedAdvances}
                              onChange={(e) => setSelectedAdvances(Array.from(e.target.selectedOptions).map((o) => o.value))}
                              className="h-20 w-64 rounded-md border px-2 text-sm"
                            >
                              {applicableAdvances.map((a) => (
                                <option key={a.id} value={a.id}>{a.docCode} · {money(a.received)}</option>
                              ))}
                            </select>
                            <Button size="sm" variant="outline" disabled={advBusy || selectedAdvances.length === 0} onClick={() => applyAdvances(detail.id)}>
                              Apliciraj izbrane avanse
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {detail.type === "INVOICE" ? (
                      <div className="rounded-lg border p-3">
                        <div className="text-sm font-semibold">Dobropisi</div>
                        {credits.length === 0 ? (
                          <p className="text-muted-foreground py-2 text-xs">Ni dobropisov.</p>
                        ) : (
                          <ul className="divide-y py-1 text-xs">
                          {credits.map((c) => (
                            <li key={c.id} className="flex items-center justify-between py-1">
                              <span>{c.docCode} · {money(c.amount)} · osnova {money(c.taxBase)} · DDV {money(c.taxTotal)}</span>
                              <span className="text-muted-foreground">{new Date(c.issuedAt).toLocaleDateString("sl-SI")}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {detail.status !== "CANCELLED" && (
                        <div className="mt-2 flex items-end gap-2">
                          <input value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="Znesek €" className="h-9 w-24 rounded-md border px-2 text-sm" />
                          <Button size="sm" variant="outline" disabled={ledgerBusy} onClick={() => bookCredit(detail.id)}>Izdaj dobropis</Button>
                        </div>
                      )}
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              {/* F5.5.4.3: arhiv + pošiljanje */}
              <div className="print:hidden mt-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="font-semibold">PDF / e-arhiv</div>
                  <span className="text-muted-foreground text-xs">
                    {archived ? `Arhivirano (SHA-256: ${archiveSha?.slice(0, 12)}…)` : "Ni še arhivirano"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button size="sm" disabled={busy} onClick={() => doArchive(detail.id)}>
                    {archived ? "Ponovno arhiviraj" : "Arhiviraj / generiraj PDF"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={!archiveId} onClick={doDownload}>
                    Prenesi PDF
                  </Button>
                  <input
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    placeholder="Prejemnik (e-pošta)"
                    className="h-9 w-56 rounded-md border px-2 text-sm"
                  />
                  <Button size="sm" variant="outline" disabled={busy || !archived} onClick={() => doSend(detail.id)}>
                    Pošlji per e-pošto
                  </Button>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {archived ? "Izvorni PDF je nespremenljiv in zavarovan; prenos gre prek zaščitene rute." : "Pred pošiljanjem arhivirajte dokument."}
                </p>
              </div>

              {/* Actions (hidden on print) */}
              <div className="print:hidden mt-2 space-y-3 border-t pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      (detail.type === "QUOTE" ? quoteStatusColors : invoiceStatusColors)[
                        detail.status
                      ] ?? ""
                    }`}
                  >
                    {statusLabels[detail.status] ?? detail.status}
                  </span>
                  {quoteActions}
                  {invoiceActions}
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => window.print()}
                  >
                    <PrinterIcon size={14} className="mr-1" />
                    {labels.detail.print}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader className="print:hidden">
                <DialogTitle>{labels.detail.title}</DialogTitle>
              </DialogHeader>
              <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">
                …
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
