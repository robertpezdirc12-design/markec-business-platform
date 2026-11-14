"use client"

// ============================================================
// F5.5.2 — FAQ upravitelj (dashboard).
// Podjetnik dodaja/ureja/razvršča pogosta vprašanja za celotno
// podjetje (serviceId = null) ali posamezno storitev. Javna
// objava gre prek publishSite; tukaj se le pripravi osnutek,
// ki ga pred objavo pregleda v predogledu.
// Orvoid: vsi klici strežniških akcij so org-scoped (settings.manage).
// ============================================================

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { PlusIcon, PencilIcon, TrashIcon } from "@/components/icons"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import type { FaqItemDTO } from "@/app/actions/faq"
import {
  createFaq,
  updateFaq,
  deleteFaq,
  reorderFaq,
} from "@/app/actions/faq"
import { useI18n } from "@/lib/i18n/provider"

interface ServiceOption {
  id: string
  name: string
}

interface FaqManagerProps {
  initial: FaqItemDTO[]
  services: ServiceOption[]
}

interface FormState {
  question: string
  answer: string
  category: string
  serviceId: string
  isPublic: boolean
}

/** Sentinel za »celotno podjetje« — Radix Select ne dovoli prazne vrednosti. */
const BUSINESS_WIDE = "__business__"

const EMPTY: FormState = {
  question: "",
  answer: "",
  category: "",
  serviceId: BUSINESS_WIDE,
  isPublic: true,
}

export function FaqManager({ initial, services }: FaqManagerProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [rows, setRows] = useState<FaqItemDTO[]>(initial)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FaqItemDTO | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = () => router.refresh()

  const set = (k: keyof FormState, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }))

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }

  const openEdit = (row: FaqItemDTO) => {
    setEditing(row)
    setForm({
      question: row.question,
      answer: row.answer,
      category: row.category ?? "",
      serviceId: row.serviceId ?? BUSINESS_WIDE,
      isPublic: row.isPublic,
    })
    setOpen(true)
  }

  const submit = async () => {
    if (!form.question.trim()) {
      toast.error(t.settings.content.faqQuestion + " (obvezno)")
      return
    }
    if (!form.answer.trim()) {
      toast.error(t.settings.content.faqAnswer + " (obvezno)")
      return
    }
    setBusy(true)
    try {
      const payload = {
        question: form.question.trim(),
        answer: form.answer.trim(),
        category: form.category.trim() || null,
        serviceId: form.serviceId === BUSINESS_WIDE ? null : form.serviceId,
        isPublic: form.isPublic,
      }
      const res = editing
        ? await updateFaq(editing.id, payload)
        : await createFaq(payload)
      if (!res.ok) {
        toast.error(res.error || "Napaka pri shranjevanju.")
        return
      }
      toast.success(
        editing
          ? t.settings.content.saveFaqSuccess
          : t.settings.content.saveFaqSuccess
      )
      setOpen(false)
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row: FaqItemDTO) => {
    if (!window.confirm(t.settings.content.deleteFaqConfirm)) return
    setBusyId(row.id)
    try {
      const res = await deleteFaq(row.id)
      if (!res.ok) {
        toast.error(res.error || "Napaka pri brisanju.")
        return
      }
      toast.success(t.settings.content.faqDeleted)
      refresh()
    } finally {
      setBusyId(null)
    }
  }

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...rows]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    const tmp = next[index]
    next[index] = next[j]
    next[j] = tmp
    setRows(next)
    const res = await reorderFaq(next.map((r) => r.id))
    if (!res.ok) toast.error(res.error || "Napaka pri razvrščanju.")
    refresh()
  }

  const serviceName = (id: string | null) =>
    id ? services.find((s) => s.id === id)?.name ?? "—" : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{t.settings.content.faqSection}</CardTitle>
          <CardDescription>{t.settings.content.faqHint}</CardDescription>
        </div>
        <Button size="sm" onClick={openCreate}>
          <PlusIcon className="mr-1 h-4 w-4" />
          {t.settings.content.newFaq}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t.settings.content.emptyState}
          </p>
        )}
        {rows.map((row, i) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{row.question}</span>
                {row.isPublished ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {t.settings.content.publishedBadge}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    {t.settings.content.draftBadge}
                  </Badge>
                )}
                {row.category && (
                  <Badge variant="outline" className="text-[10px]">
                    {row.category}
                  </Badge>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {row.answer}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {serviceName(row.serviceId)
                  ? `${t.settings.content.faqForService}: ${serviceName(row.serviceId)}`
                  : t.settings.content.faqBusinessWide}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={t.settings.content.moveUp}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t.settings.content.moveDown}
                disabled={i === rows.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t.settings.content.updateFaq}
                onClick={() => openEdit(row)}
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t.settings.content.deleteFaq}
                disabled={busyId === row.id}
                onClick={() => remove(row)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t.settings.content.updateFaq
                : t.settings.content.newFaq}
            </DialogTitle>
            <DialogDescription>
              {t.settings.content.faqHint}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="faq-question">{t.settings.content.faqQuestion}</Label>
              <Input
                id="faq-question"
                value={form.question}
                placeholder={t.settings.content.faqQuestionPlaceholder}
                onChange={(e) => set("question", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="faq-answer">{t.settings.content.faqAnswer}</Label>
              <Textarea
                id="faq-answer"
                rows={4}
                value={form.answer}
                placeholder={t.settings.content.faqAnswerPlaceholder}
                onChange={(e) => set("answer", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="faq-category">{t.settings.content.faqCategory}</Label>
              <Input
                id="faq-category"
                value={form.category}
                placeholder={t.settings.content.faqCategoryPlaceholder}
                onChange={(e) => set("category", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.settings.content.faqForService}</Label>
              <Select
                value={form.serviceId}
                onValueChange={(v) => set("serviceId", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t.settings.content.faqBusinessWide} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BUSINESS_WIDE}>
                    {t.settings.content.faqBusinessWide}
                  </SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>{t.settings.content.faqPublicLabel}</Label>
              </div>
              <Switch
                checked={form.isPublic}
                onCheckedChange={(v) => set("isPublic", v)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Prekliči
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy
                ? t.settings.content.saving
                : editing
                  ? t.settings.content.updateFaq
                  : t.settings.content.saveFaq}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}