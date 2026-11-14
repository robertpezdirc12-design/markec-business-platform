"use client"

import { useActionState, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { SpinnerIcon } from "@/components/icons/spinner-icon"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n/provider"
import { createPromotion, updatePromotion, generatePromotionCode } from "@/app/actions/promotions"

export interface PromotionTargetOption {
  id: string
  name: string
}

export interface PromotionFormData {
  id: string
  name: string
  description: string | null
  discountType: "PERCENT" | "FIXED"
  discountValue: number
  scope: "WHOLE_AMOUNT" | "PRODUCTS" | "SERVICES" | "CATEGORIES"
  targetEntityIds: string[]
  code: string | null
  startsAt: Date | null
  endsAt: Date | null
  maxRedemptions: number | null
  maxPerCustomer: number | null
  minOrderValue: number | null
  status: "DRAFT" | "ACTIVE" | "INACTIVE"
}

interface PromotionFormProps {
  mode: "create" | "edit"
  promotion?: PromotionFormData
  options: {
    products: PromotionTargetOption[]
    services: PromotionTargetOption[]
    categories: PromotionTargetOption[]
  }
}

const toDateInput = (d: Date | null | undefined) => {
  if (!d) return ""
  const dt = new Date(d)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(
    dt.getHours()
  )}:${pad(dt.getMinutes())}`
}

export function PromotionForm({ mode, promotion, options }: PromotionFormProps) {
  const { t } = useI18n()
  const router = useRouter()
  const isEdit = mode === "edit"
  const p = promotion as PromotionFormData | undefined

  const [form, setForm] = useState({
    name: p?.name ?? "",
    description: p?.description ?? "",
    discountType: (p?.discountType ?? "PERCENT") as "PERCENT" | "FIXED",
    discountValue: p ? String(p.discountValue) : "",
    scope: (p?.scope ?? "WHOLE_AMOUNT") as "WHOLE_AMOUNT" | "PRODUCTS" | "SERVICES" | "CATEGORIES",
    targetEntityIds: p?.targetEntityIds ?? [],
    code: p?.code ?? "",
    startsAt: toDateInput(p?.startsAt),
    endsAt: toDateInput(p?.endsAt),
    maxRedemptions: p?.maxRedemptions != null ? String(p.maxRedemptions) : "",
    maxPerCustomer: p?.maxPerCustomer != null ? String(p.maxPerCustomer) : "",
    minOrderValue:
      p?.minOrderValue != null && p.minOrderValue > 0 ? String(p.minOrderValue) : "",
    // Stanje lahko nastavi skrbnik NEPOSREDNO ob KREIRANJU (create); pri
    // urejanju (edit) se status upravlja ločeno v seznamu promocij.
    status: ((p?.status ?? "DRAFT") as "DRAFT" | "ACTIVE" | "INACTIVE"),
  })

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const parseOpt = (v: FormDataEntryValue | null): number | null => {
    const s = String(v ?? "").trim()
    if (!s) return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }

  const [state, submit, pending] = useActionState(
    async (_prev: unknown, fd: FormData) => {
      const payload = {
        name: fd.get("name"),
        description: fd.get("description") || null,
        discountType: fd.get("discountType"),
        discountValue: Number(fd.get("discountValue")),
        scope: fd.get("scope"),
        targetEntityIds: form.targetEntityIds,
        code: fd.get("code") || null,
        startsAt: fd.get("startsAt") || null,
        endsAt: fd.get("endsAt") || null,
        maxRedemptions: parseOpt(fd.get("maxRedemptions")),
        maxPerCustomer: parseOpt(fd.get("maxPerCustomer")),
        minOrderValue: parseOpt(fd.get("minOrderValue")),
        // Ob KREIRANJU skrbnik izbere stanje (DRAFT/ACTIVE); omogoča, da
        // pri ustvarjanju promocijo TAKOJ vklopiš. Pri urejanju se status
        // ne pošilja — upravlja se prek seznama (strežnik ga zavrne).
        status: isEdit ? undefined : form.status,
      }
      const res = isEdit
        ? await updatePromotion(p!.id, payload)
        : await createPromotion(payload)
      if (!res.success) return { error: res.error }
      toast.success(t.promotions.saved)
      router.push("/dashboard/promotions")
      router.refresh()
      return { error: null }
    },
    { error: null as string | null }
  )

  // Target options depend on the chosen scope.
  const targetGroups: { key: string; label: string; items: PromotionTargetOption[] }[] = []
  if (form.scope === "PRODUCTS") {
    targetGroups.push({ key: "products", label: t.promotions.scopeProducts, items: options.products })
  } else if (form.scope === "SERVICES") {
    targetGroups.push({ key: "services", label: t.promotions.scopeServices, items: options.services })
  } else if (form.scope === "CATEGORIES") {
    targetGroups.push({ key: "categories", label: t.promotions.scopeCategories, items: options.categories })
  }

  const toggleTarget = (id: string) => {
    set({
      targetEntityIds: form.targetEntityIds.includes(id)
        ? form.targetEntityIds.filter((x) => x !== id)
        : [...form.targetEntityIds, id],
    })
  }

  // F5.1 UX: varna strežniška generacija kode (crypto randomness +
  // preverba unikatnosti v bazi, kot Stripe/Shopify) — skrbnik jo
  // klikne, ko ne želi izumljati kode ročno.
  const [generatingCode, startGenerateCode] = useTransition()
  const generateCode = () => {
    startGenerateCode(async () => {
      const r = await generatePromotionCode()
      if (r.error) {
        toast.error(r.error)
        return
      }
      set({ code: r.code })
    })
  }

  return (
    <form action={submit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {isEdit ? t.promotions.formTitleEdit : t.promotions.formTitleNew}
          </CardTitle>
          <CardDescription>{t.promotions.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {state.error && (
            <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
              {state.error}
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="promo-name">{t.promotions.name}</Label>
            <Input
              id="promo-name"
              name="name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder={t.promotions.namePlaceholder}
              required
            />
            <p className="text-muted-foreground text-xs">{t.promotions.nameHelp}</p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="promo-desc">{t.promotions.description}</Label>
            <Textarea
              id="promo-desc"
              name="description"
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder={t.promotions.descriptionPlaceholder}
              rows={2}
            />
          </div>

          {/* Discount type + value */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="promo-type">{t.promotions.discountType}</Label>
              <Select
                value={form.discountType}
                onValueChange={(v) => set({ discountType: v as "PERCENT" | "FIXED" })}
              >
                <SelectTrigger id="promo-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">{t.promotions.discountTypePercent}</SelectItem>
                  <SelectItem value="FIXED">{t.promotions.discountTypeFixed}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-value">
                {form.discountType === "PERCENT"
                  ? t.promotions.discountValuePercent
                  : t.promotions.discountValueFixed}
              </Label>
              <Input
                id="promo-value"
                name="discountValue"
                type="number"
                min={0}
                max={form.discountType === "PERCENT" ? 100 : undefined}
                step={0.01}
                value={form.discountValue}
                onChange={(e) => set({ discountValue: e.target.value })}
                required
              />
              <p className="text-muted-foreground text-xs">
                {form.discountType === "PERCENT"
                  ? t.promotions.discountValueHelpPercent
                  : t.promotions.discountValueHelpFixed}
              </p>
            </div>
          </div>

          {/* Scope */}
          <div className="space-y-2">
            <Label htmlFor="promo-scope">{t.promotions.scope}</Label>
            <Select
              value={form.scope}
              onValueChange={(v) =>
                set({ scope: v as typeof form.scope, targetEntityIds: [] })
              }
            >
              <SelectTrigger id="promo-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WHOLE_AMOUNT">{t.promotions.scopeWhole}</SelectItem>
                <SelectItem value="PRODUCTS">{t.promotions.scopeProducts}</SelectItem>
                <SelectItem value="SERVICES">{t.promotions.scopeServices}</SelectItem>
                <SelectItem value="CATEGORIES">{t.promotions.scopeCategories}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">{t.promotions.scopeHelp}</p>
          </div>

          {/* Targets (multi-select chips) */}
          {targetGroups.length > 0 && (
            <div className="space-y-2">
              <Label>{t.promotions.targets}</Label>
              {targetGroups[0].items.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {form.scope === "PRODUCTS"
                    ? t.promotions.allProducts
                    : form.scope === "SERVICES"
                      ? t.promotions.allServices
                      : t.promotions.scopeCategories}
                </p>
              ) : (
                <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-md border p-3">
                  {targetGroups[0].items.map((opt) => {
                    const selected = form.targetEntityIds.includes(opt.id)
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleTarget(opt.id)}
                        aria-pressed={selected}
                        className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-muted"
                        }`}
                      >
                        {opt.name}
                      </button>
                    )
                  })}
                </div>
              )}
              <p className="text-muted-foreground text-xs">
                {t.promotions.targetsHelp}
              </p>
            </div>
          )}

          {/* Code */}
          <div className="space-y-2">
            <Label htmlFor="promo-code">{t.promotions.code}</Label>
            <div className="flex gap-2">
              <Input
                id="promo-code"
                name="code"
                value={form.code}
                onChange={(e) => set({ code: e.target.value.toUpperCase() })}
                placeholder={t.promotions.codePlaceholder}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={generateCode}
                disabled={generatingCode}
              >
                {generatingCode ? "…" : t.promotions.generateCode}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              {t.promotions.codeHelp} · {t.promotions.noCode}
            </p>
          </div>

          {/* Dates */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="promo-start">{t.promotions.startsAt}</Label>
              <Input
                id="promo-start"
                name="startsAt"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => set({ startsAt: e.target.value })}
              />
              <p className="text-muted-foreground text-xs">{t.promotions.startsAtHelp}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-end">{t.promotions.endsAt}</Label>
              <Input
                id="promo-end"
                name="endsAt"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => set({ endsAt: e.target.value })}
              />
              <p className="text-muted-foreground text-xs">{t.promotions.endsAtHelp}</p>
            </div>
          </div>

          {/* Limits */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="promo-max">{t.promotions.maxRedemptions}</Label>
              <Input
                id="promo-max"
                name="maxRedemptions"
                type="number"
                min={1}
                value={form.maxRedemptions}
                onChange={(e) => set({ maxRedemptions: e.target.value })}
                placeholder="∞"
              />
              <p className="text-muted-foreground text-xs">{t.promotions.maxRedemptionsHelp}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-per">{t.promotions.maxPerCustomer}</Label>
              <Input
                id="promo-per"
                name="maxPerCustomer"
                type="number"
                min={1}
                value={form.maxPerCustomer}
                onChange={(e) => set({ maxPerCustomer: e.target.value })}
                placeholder="∞"
              />
              <p className="text-muted-foreground text-xs">{t.promotions.maxPerCustomerHelp}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-min">{t.promotions.minOrderValue}</Label>
              <Input
                id="promo-min"
                name="minOrderValue"
                type="number"
                min={0}
                step={0.01}
                value={form.minOrderValue}
                onChange={(e) => set({ minOrderValue: e.target.value })}
                placeholder="0"
              />
              <p className="text-muted-foreground text-xs">{t.promotions.minOrderValueHelp}</p>
            </div>
          </div>

          {/* Hidden scope value for the form payload */}
          <input type="hidden" name="discountType" value={form.discountType} />
          <input type="hidden" name="scope" value={form.scope} />
          <input type="hidden" name="targetEntityIds" value={JSON.stringify(form.targetEntityIds)} />

          {/* Status — SKRBENIK lahko promocijo ob KREIRANJU takoj vklopi.
              Pri urejanju se status upravlja v seznamu promocij. */}
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="promo-status">{t.promotions.status}</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set({ status: v as typeof form.status })}
              >
                <SelectTrigger id="promo-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">{t.promotions.statusDraft}</SelectItem>
                  <SelectItem value="ACTIVE">{t.promotions.statusActive}</SelectItem>
                  <SelectItem value="INACTIVE">{t.promotions.statusInactive}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">{t.promotions.statusHelp}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/promotions")}
              disabled={pending}
            >
              {t.promotions.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <SpinnerIcon size={16} className="mr-2" />}
              {pending ? t.promotions.saving : t.promotions.save}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}