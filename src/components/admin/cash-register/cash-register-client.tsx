"use client"

// ============================================================
// BLAGAJNA (WP-1) — odjemalski pogled
//
// Ena stran za dnevno denarno sejo:
//   • odpiranje z začetnim fondom,
//   • prodaja (izdelek + količina + način plačila) → Order prek
//     createDirectOrder (enotna denarna pot, brez ločenega seznama prodaj),
//   • drobni strošek,
//   • zaprtje: oštevilčena gotovina vs. pričakovano stanje + odstopanje,
//   • zgodovina zaprtih sej.
//
// Vsi izračuni pridejo s strežnika (src/lib/cash-register/core.ts), zato
// UI nikoli ne sešteva sam — prikazuje le prejete številke.
// ============================================================

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { WalletIcon } from "@/components/icons"
import {
  addCashExpense,
  closeCashSession,
  openCashSession,
  type CashRegisterState,
} from "@/app/actions/cash-register"
import { createDirectOrder } from "@/app/actions/direct-sale"

interface Labels {
  title: string
  description: string
  openTitle: string
  openDescription: string
  openingFloat: string
  openButton: string
  openSubmitting: string
  openSuccess: string
  openError: string
  alreadyOpen: string
  session: {
    OPEN: string
    CLOSED: string
    openedAt: string
    openedBy: string
    closedAt: string
    closedBy: string
    staff: string
  }
  totals: {
    sales: string
    cash: string
    card: string
    transfer: string
    expenses: string
    openingFloat: string
    expectedCash: string
  }
  sale: {
    title: string
    product: string
    productPlaceholder: string
    quantity: string
    paymentMethod: string
    methodCash: string
    methodCard: string
    methodTransfer: string
    customer: string
    customerPlaceholder: string
    submit: string
    submitting: string
    success: string
    error: string
    noProducts: string
  }
  expense: {
    title: string
    label: string
    labelPlaceholder: string
    category: string
    catChange: string
    catPurchase: string
    catOther: string
    amount: string
    submit: string
    success: string
    error: string
  }
  close: {
    title: string
    description: string
    countedCash: string
    expected: string
    confirm: string
    submit: string
    submitting: string
    success: string
    error: string
  }
  variance: { label: string; short: string; over: string; exact: string }
  transactions: {
    title: string
    time: string
    type: string
    SALE: string
    EXPENSE: string
    amount: string
    order: string
    none: string
  }
  history: {
    title: string
    opened: string
    closed: string
    sales: string
    expenses: string
    expected: string
    actual: string
    variance: string
    none: string
  }
  errors: Record<string, string>
}

const eur = (n: number, locale: string) =>
  new Intl.NumberFormat(locale === "en" ? "en-GB" : "sl-SI", {
    style: "currency",
    currency: "EUR",
  }).format(n)

const dt = (iso: string | null, locale: string) =>
  iso
    ? new Date(iso).toLocaleString(locale === "en" ? "en-GB" : "sl-SI", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—"

export function CashRegisterClient({
  state,
  labels,
  locale,
}: {
  state: CashRegisterState
  labels: Labels
  locale: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [openingFloat, setOpeningFloat] = useState("")
  const [productId, setProductId] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [method, setMethod] = useState<"cash" | "card" | "transfer">("cash")
  const [customerId, setCustomerId] = useState("")
  const [expenseLabel, setExpenseLabel] = useState("")
  const [expenseCategory, setExpenseCategory] = useState<"drobci" | "nakup" | "drugo">("drugo")
  const [expenseAmount, setExpenseAmount] = useState("")
  const [countedCash, setCountedCash] = useState("")
  const [closeNotes, setCloseNotes] = useState("")

  const session = state.openSession
  const errorText = (code?: string) =>
    (code && labels.errors[code]) || labels.errors.GENERIC

  const run = (
    action: () => Promise<{ ok: boolean; error?: string }>,
    successMessage: string
  ) => {
    startTransition(async () => {
      try {
        const res = await action()
        if (res.ok) {
          toast.success(successMessage)
          router.refresh()
        } else {
          toast.error(errorText(res.error))
        }
      } catch {
        toast.error(errorText("GENERIC"))
      }
    })
  }

  const submitOpen = (e: React.FormEvent) => {
    e.preventDefault()
    run(() => openCashSession({ openingFloat }), labels.openSuccess)
    setOpeningFloat("")
  }

  const submitSale = (e: React.FormEvent) => {
    e.preventDefault()
    if (!productId) {
      toast.error(labels.sale.noProducts)
      return
    }
    const qty = Number(quantity)
    run(
      () =>
        createDirectOrder({
          lines: [{ productId, quantity: Number.isFinite(qty) && qty > 0 ? qty : 1 }],
          paymentMethod: method,
          customerId: customerId || null,
          cashSessionId: session?.id ?? null,
        }).then((r) => ({ ok: r.success, error: r.error })),
      labels.sale.success
    )
    setQuantity("1")
  }

  const submitExpense = (e: React.FormEvent) => {
    e.preventDefault()
    run(
      () => addCashExpense({ label: expenseLabel, category: expenseCategory, amount: expenseAmount }),
      labels.expense.success
    )
    setExpenseLabel("")
    setExpenseAmount("")
  }

  const submitClose = (e: React.FormEvent) => {
    e.preventDefault()
    if (!window.confirm(labels.close.confirm)) return
    run(
      () => closeCashSession({ countedCash, notes: closeNotes || null }),
      labels.close.success
    )
    setCountedCash("")
    setCloseNotes("")
  }

  const totals = session?.totals
  const selectedProduct = state.products.find((p) => p.id === productId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <WalletIcon size={26} />
          {labels.title}
        </h1>
        <p className="text-muted-foreground mt-1">{labels.description}</p>
      </div>

      {!session ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.openTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">{labels.openDescription}</p>
            <form onSubmit={submitOpen} className="flex flex-wrap items-end gap-3">
              <div className="min-w-40 flex-1">
                <Label htmlFor="opening-float" className="mb-1 block text-xs">
                  {labels.openingFloat}
                </Label>
                <Input
                  id="opening-float"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? labels.openSubmitting : labels.openButton}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stanje seje */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { key: "sales", label: labels.totals.sales, value: totals?.salesTotal ?? 0 },
              { key: "cash", label: labels.totals.cash, value: totals?.cashTotal ?? 0 },
              { key: "card", label: labels.totals.card, value: totals?.cardTotal ?? 0 },
              { key: "transfer", label: labels.totals.transfer, value: totals?.transferTotal ?? 0 },
              { key: "expenses", label: labels.totals.expenses, value: totals?.expensesTotal ?? 0 },
              { key: "expected", label: labels.totals.expectedCash, value: totals?.expectedCash ?? 0 },
            ].map((t) => (
              <Card key={t.key}>
                <CardContent className="p-4">
                  <p className="text-muted-foreground text-xs">{t.label}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {eur(t.value, locale)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <span>
              {labels.session.openedAt}: {dt(session.openedAt, locale)}
            </span>
            {session.openedByEmail && (
              <span>
                {labels.session.openedBy}: {session.openedByEmail}
              </span>
            )}
            <span>
              {labels.totals.openingFloat}: {eur(session.openingFloat, locale)}
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Prodaja */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{labels.sale.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {state.products.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{labels.sale.noProducts}</p>
                ) : (
                  <form onSubmit={submitSale} className="space-y-3">
                    <div>
                      <Label htmlFor="sale-product" className="mb-1 block text-xs">
                        {labels.sale.product}
                      </Label>
                      <select
                        id="sale-product"
                        value={productId}
                        onChange={(e) => setProductId(e.target.value)}
                        className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
                      >
                        <option value="">{labels.sale.productPlaceholder}</option>
                        {state.products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {eur(p.price, locale)}
                            {p.stock <= 0 ? " · 0" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <div className="w-24">
                        <Label htmlFor="sale-qty" className="mb-1 block text-xs">
                          {labels.sale.quantity}
                        </Label>
                        <Input
                          id="sale-qty"
                          type="number"
                          min={1}
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                        />
                      </div>
                      <div className="min-w-40 flex-1">
                        <Label htmlFor="sale-method" className="mb-1 block text-xs">
                          {labels.sale.paymentMethod}
                        </Label>
                        <select
                          id="sale-method"
                          value={method}
                          onChange={(e) => setMethod(e.target.value as "cash" | "card" | "transfer")}
                          className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
                        >
                          <option value="cash">{labels.sale.methodCash}</option>
                          <option value="card">{labels.sale.methodCard}</option>
                          <option value="transfer">{labels.sale.methodTransfer}</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="sale-customer" className="mb-1 block text-xs">
                        {labels.sale.customer}
                      </Label>
                      <select
                        id="sale-customer"
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
                      >
                        <option value="">{labels.sale.customerPlaceholder}</option>
                        {state.customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {selectedProduct
                          ? `× ${quantity || 0} = ${eur(
                              selectedProduct.price * (Number(quantity) || 0),
                              locale
                            )}`
                          : ""}
                      </span>
                      <Button type="submit" size="sm" disabled={pending || !productId}>
                        {pending ? labels.sale.submitting : labels.sale.submit}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* Stroški + zaprtje */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{labels.expense.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submitExpense} className="space-y-3">
                    <div className="flex flex-wrap gap-3">
                      <div className="min-w-40 flex-1">
                        <Label htmlFor="exp-label" className="mb-1 block text-xs">
                          {labels.expense.label}
                        </Label>
                        <Input
                          id="exp-label"
                          value={expenseLabel}
                          onChange={(e) => setExpenseLabel(e.target.value)}
                          placeholder={labels.expense.labelPlaceholder}
                        />
                      </div>
                      <div className="w-28">
                        <Label htmlFor="exp-amount" className="mb-1 block text-xs">
                          {labels.expense.amount}
                        </Label>
                        <Input
                          id="exp-amount"
                          inputMode="decimal"
                          value={expenseAmount}
                          onChange={(e) => setExpenseAmount(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-32 flex-1">
                        <Label htmlFor="exp-cat" className="mb-1 block text-xs">
                          {labels.expense.category}
                        </Label>
                        <select
                          id="exp-cat"
                          value={expenseCategory}
                          onChange={(e) =>
                            setExpenseCategory(e.target.value as "drobci" | "nakup" | "drugo")
                          }
                          className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
                        >
                          <option value="drobci">{labels.expense.catChange}</option>
                          <option value="nakup">{labels.expense.catPurchase}</option>
                          <option value="drugo">{labels.expense.catOther}</option>
                        </select>
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={pending || !expenseLabel.trim() || !expenseAmount}
                      >
                        {labels.expense.submit}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{labels.close.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-3 text-sm">{labels.close.description}</p>
                  <form onSubmit={submitClose} className="space-y-3">
                    <div className="flex items-end justify-between gap-3">
                      <span className="text-sm">
                        {labels.close.expected}:{" "}
                        <span className="font-semibold tabular-nums">
                          {eur(totals?.expectedCash ?? 0, locale)}
                        </span>
                      </span>
                    </div>
                    <div>
                      <Label htmlFor="close-counted" className="mb-1 block text-xs">
                        {labels.close.countedCash}
                      </Label>
                      <Input
                        id="close-counted"
                        inputMode="decimal"
                        value={countedCash}
                        onChange={(e) => setCountedCash(e.target.value)}
                      />
                    </div>
                    <Input
                      placeholder={labels.session.staff}
                      value={closeNotes}
                      onChange={(e) => setCloseNotes(e.target.value)}
                      aria-label={labels.session.staff}
                    />
                    {countedCash !== "" && Number.isFinite(Number(countedCash.replace(",", "."))) && (
                      <p className="text-sm">
                        {labels.variance.label}:{" "}
                        <span
                          className={
                            Number(countedCash.replace(",", ".")) -
                              (totals?.expectedCash ?? 0) ===
                            0
                              ? "text-emerald-600"
                              : "text-amber-600"
                          }
                        >
                          {(() => {
                            const v =
                              Number(countedCash.replace(",", ".")) - (totals?.expectedCash ?? 0)
                            if (Math.abs(v) < 0.005) return labels.variance.exact
                            return `${v > 0 ? labels.variance.over : labels.variance.short} ${eur(
                              Math.abs(v),
                              locale
                            )}`
                          })()}
                        </span>
                      </p>
                    )}
                    <Button
                      type="submit"
                      size="sm"
                      variant="destructive"
                      disabled={pending || countedCash === ""}
                    >
                      {pending ? labels.close.submitting : labels.close.submit}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Gibi seje */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{labels.transactions.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {state.transactions.length === 0 ? (
                <p className="text-muted-foreground text-sm">{labels.transactions.none}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground border-b text-left text-xs">
                        <th className="py-2 pr-3 font-medium">{labels.transactions.time}</th>
                        <th className="py-2 pr-3 font-medium">{labels.transactions.type}</th>
                        <th className="py-2 pr-3 font-medium">{labels.transactions.order}</th>
                        <th className="py-2 text-right font-medium">{labels.transactions.amount}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.transactions.map((t) => (
                        <tr key={t.id} className="border-b last:border-0">
                          <td className="py-2 pr-3 whitespace-nowrap">{dt(t.at, locale)}</td>
                          <td className="py-2 pr-3">
                            <span
                              className={
                                t.type === "SALE"
                                  ? "text-emerald-600"
                                  : "text-amber-600"
                              }
                            >
                              {t.type === "SALE"
                                ? labels.transactions.SALE
                                : labels.transactions.EXPENSE}
                            </span>
                          </td>
                          <td className="max-w-56 truncate py-2 pr-3">{t.label}</td>
                          <td className="py-2 text-right tabular-nums">
                            {t.type === "EXPENSE" ? "−" : ""}
                            {eur(t.amount, locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Zgodovina */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{labels.history.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {state.history.length === 0 ? (
            <p className="text-muted-foreground text-sm">{labels.history.none}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs">
                    <th className="py-2 pr-3 font-medium">{labels.history.opened}</th>
                    <th className="py-2 pr-3 font-medium">{labels.history.closed}</th>
                    <th className="py-2 pr-3 text-right font-medium">{labels.history.sales}</th>
                    <th className="py-2 pr-3 text-right font-medium">{labels.history.expenses}</th>
                    <th className="py-2 pr-3 text-right font-medium">{labels.history.expected}</th>
                    <th className="py-2 pr-3 text-right font-medium">{labels.history.actual}</th>
                    <th className="py-2 text-right font-medium">{labels.history.variance}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.history.map((h) => (
                    <tr key={h.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap">{dt(h.openedAt, locale)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{dt(h.closedAt, locale)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {eur(h.totals.salesTotal, locale)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {eur(h.totals.expensesTotal, locale)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {eur(h.totals.expectedCash, locale)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {eur(h.actualAmount ?? 0, locale)}
                      </td>
                      <td
                        className={`py-2 text-right tabular-nums ${
                          (h.varianceAmount ?? 0) === 0
                            ? "text-emerald-600"
                            : "text-amber-600"
                        }`}
                      >
                        {(h.varianceAmount ?? 0) > 0 ? "+" : ""}
                        {eur(h.varianceAmount ?? 0, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
