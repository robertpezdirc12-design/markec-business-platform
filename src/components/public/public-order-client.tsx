"use client"

// ============================================================
// JAVNA STRAN NAROČILA (odjemalski del)
//
// Stranka vidi predračun in ima tri možna dejanja:
//   1. potrdi predračun (cena + rok),
//   2. zavrne z razlogom,
//   3. plača depozit prek Stripe (samo ko je depozit načrtovan in ima
//      najemnik svoj Stripe ključ — drugače gumba ni, brez praznih obljub).
//
// Vsi zneski pridejo izračunani s strežnika (payment-summary.ts).
// ============================================================

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircleIcon, WarningCircleIcon } from "@/components/icons"
import {
  approveWorkOrderQuote,
  createWorkOrderDepositCheckout,
  declineWorkOrderQuote,
} from "@/app/actions/work-order-public"
import { cn } from "@/lib/utils"

interface PublicOrder {
  number: number
  title: string
  status: string
  customerName: string | null
  dueDateLabel: string | null
  stageName: string | null
  stageNumber: number | null
  totalStages: number
  notes: string | null
  approvedAt: string | null
  declinedAt: string | null
  declineReason: string | null
  depositAmount: number | null
  depositCovered: boolean
  paid: number
  balance: number
  payments: { amount: number; method: string; paidAt: string }[]
  paymentState: "NONE" | "UNPAID" | "PARTIAL" | "PAID"
}

interface Business {
  name: string
  phone: string | null
  email: string | null
  slug: string
}

const eur = (n: number) =>
  new Intl.NumberFormat("sl-SI", { style: "currency", currency: "EUR" }).format(n)

const methodLabel = (m: string) =>
  ({ cash: "Gotovina", card: "Kartica", transfer: "Nakazilo", stripe: "Kartica (splet)" })[m] ?? m

export function PublicOrderClient({
  token,
  order,
  business,
  stripeConfigured,
  justPaid,
}: {
  token: string
  order: PublicOrder
  business: Business
  stripeConfigured: boolean
  justPaid: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  const approved = !!order.approvedAt
  const declined = !!order.declinedAt
  const hasQuote = order.paymentState !== "NONE"

  const depositRemaining =
    order.depositAmount !== null ? Math.max(0, order.depositAmount - order.paid) : 0
  const canPayDeposit =
    stripeConfigured && depositRemaining > 0.5 && !declined && order.status === "OPEN"
  const needsDepositNotice = !stripeConfigured && depositRemaining > 0.5 && !declined

  const errorText = (code?: string) =>
    ({
      RATE_LIMITED: "Preveč poskusov v kratkem času. Poskusite znova čez minuto.",
      NOT_FOUND: "Povezava ni veljavna ali je bila preklicana.",
      NOT_OPEN: "Naročilo ni več odprto — kontaktirajte izvajalca.",
      ALREADY_DECLINED: "Predračun je že zavrnjen.",
      ALREADY_APPROVED: "Predračun je že potrjen.",
      NO_TOTAL: "Predračun še ni pripravljen — kontaktirajte izvajalca.",
      REASON_REQUIRED: "Vpišite razlog zavrnitve (vsaj 3 znake).",
      NO_DEPOSIT: "Depozit ni načrtovan.",
      DEPOSIT_ALREADY_PAID: "Depozit je že poravnan.",
      STRIPE_NOT_CONFIGURED: "Spletno plačilo pri tem izvajalcu ni nastavljeno.",
      STRIPE_ERROR: "Plačila ni bilo mogoče začeti. Poskusite znova.",
      GENERIC: "Dejanje ni uspelo. Poskusite znova.",
    })[code ?? "GENERIC"] ?? "Dejanje ni uspelo. Poskusite znova."

  const approve = () => {
    setError(null)
    startTransition(async () => {
      const res = await approveWorkOrderQuote(token)
      if (res.ok) router.refresh()
      else setError(errorText(res.error))
    })
  }

  const decline = () => {
    setError(null)
    startTransition(async () => {
      const res = await declineWorkOrderQuote(token, reason)
      if (res.ok) {
        setDeclining(false)
        router.refresh()
      } else setError(errorText(res.error))
    })
  }

  const payDeposit = () => {
    setError(null)
    startTransition(async () => {
      const res = await createWorkOrderDepositCheckout(token)
      if (res.ok && res.checkoutUrl) window.location.href = res.checkoutUrl
      else setError(errorText(res.error))
    })
  }

  return (
    <div className="from-muted/30 via-background to-muted/20 min-h-screen bg-linear-to-b py-10">
      <div className="container mx-auto max-w-2xl px-4">
        <header className="mb-6">
          <p className="text-muted-foreground text-sm">{business.name}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Naročilo #{String(order.number).padStart(3, "0")}
          </h1>
          <p className="text-muted-foreground mt-1">{order.title}</p>
        </header>

        {justPaid && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
            <CheckCircleIcon size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            <p>
              Hvala — plačilo je prejeto. Če se znesek spodaj še ni posodobil, osvežite
              stran čez nekaj sekund.
            </p>
          </div>
        )}

        {/* Predračun */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Predračun</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Znesek</span>
              <span className="text-xl font-semibold tabular-nums">
                {order.paymentState === "NONE" ? "—" : eur(order.balance + order.paid)}
              </span>
            </div>
            {order.dueDateLabel && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rok izdelave</span>
                <span className="font-medium">{order.dueDateLabel}</span>
              </div>
            )}
            {order.depositAmount !== null && order.depositAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Depozit</span>
                <span className="font-medium">
                  {eur(order.depositAmount)}{" "}
                  {order.depositCovered ? (
                    <span className="text-emerald-600">— plačan</span>
                  ) : (
                    <span className="text-amber-600">— odprt</span>
                  )}
                </span>
              </div>
            )}
            {order.paid > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Že plačano</span>
                  <span className="font-medium tabular-nums">{eur(order.paid)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Za plačilo ob prevzemu</span>
                  <span className="font-semibold tabular-nums">{eur(order.balance)}</span>
                </div>
              </>
            )}
            {order.stageName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stanje</span>
                <span className="font-medium">
                  {order.stageName}
                  {order.stageNumber && order.totalStages > 0
                    ? ` (${order.stageNumber}/${order.totalStages})`
                    : ""}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Potrditev */}
        {order.status !== "OPEN" ? (
          <Card className="mb-4">
            <CardContent className="p-4 text-sm">
              Naročilo je {order.status === "COMPLETED" ? "zaključeno" : "preklicano"} — za
              spremembe kontaktirajte {business.name}.
            </CardContent>
          </Card>
        ) : declined ? (
          <Card className="mb-4 border-amber-500/40">
            <CardContent className="flex items-start gap-2 p-4 text-sm">
              <WarningCircleIcon size={18} className="mt-0.5 shrink-0 text-amber-500" />
              <div>
                <p className="font-medium">Predračun je zavrnjen.</p>
                {order.declineReason && (
                  <p className="text-muted-foreground mt-1">Razlog: {order.declineReason}</p>
                )}
                <p className="text-muted-foreground mt-1">
                  Za dogovor o novem predračunu nas kontaktirajte
                  {business.phone ? ` na ${business.phone}` : ""}
                  {business.email ? ` ali ${business.email}` : ""}.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : approved ? (
          <Card className="mb-4 border-emerald-500/40 bg-emerald-500/5">
            <CardContent className="flex items-start gap-2 p-4 text-sm">
              <CheckCircleIcon size={18} className="mt-0.5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-medium">Predračun je potrjen.</p>
                <p className="text-muted-foreground mt-1">
                  Hvala — izvajalec je prejel vašo potrditev in nadaljuje z izdelavo.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : !hasQuote ? (
          <Card className="mb-4">
            <CardContent className="p-4 text-sm">
              Predračun še ni pripravljen. Ko bo, boste na tej povezavi videli znesek in
              rok ter ju lahko potrdili.
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Potrditev predračuna</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">
                S potrditvijo se strinjate z zneskom in rokom izdelave.
              </p>
              {!declining ? (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={approve} disabled={pending}>
                    {pending ? "Potrjujem …" : "Potrdi predračun"}
                  </Button>
                  <Button variant="outline" onClick={() => setDeclining(true)} disabled={pending}>
                    Ne morem potrditi
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Kaj naj izvajalec upošteva (npr. predrago, drug rok …)?"
                    rows={3}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="destructive" onClick={decline} disabled={pending}>
                      {pending ? "Pošiljam …" : "Pošlji zavrnitev"}
                    </Button>
                    <Button variant="ghost" onClick={() => setDeclining(false)} disabled={pending}>
                      Prekliči
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Depozit */}
        {canPayDeposit && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Depozit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-muted-foreground text-sm">
                Za potrditev izdelave je potreben depozit {eur(depositRemaining)}. Znesek se
                odšteje od končnega plačila.
              </p>
              <Button onClick={payDeposit} disabled={pending}>
                {pending ? "Odpiram plačilo …" : `Plačaj depozit ${eur(depositRemaining)}`}
              </Button>
            </CardContent>
          </Card>
        )}

        {needsDepositNotice && (
          <Card className="mb-4">
            <CardContent className="p-4 text-sm">
              <p className="font-medium">Depozit: {eur(depositRemaining)}</p>
              <p className="text-muted-foreground mt-1">
                Spletno plačilo pri tem izvajalcu ni nastavljeno — depozit poravnate
                {business.phone ? ` po telefonu ${business.phone}` : " ob dogovoru"}
                {business.email ? ` ali prek ${business.email}` : ""}.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Plačila */}
        {order.payments.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Prejeta plačila</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {order.payments.map((p, i) => (
                  <li
                    key={`${p.paidAt}-${i}`}
                    className={cn("flex justify-between border-b py-1 last:border-0")}
                  >
                    <span className="text-muted-foreground">
                      {new Date(p.paidAt).toLocaleDateString("sl-SI")} · {methodLabel(p.method)}
                    </span>
                    <span className="font-medium tabular-nums">{eur(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <WarningCircleIcon size={18} className="text-destructive mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <footer className="text-muted-foreground mt-8 space-y-1 text-xs">
          <p>
            {business.name}
            {business.phone ? ` · ${business.phone}` : ""}
            {business.email ? ` · ${business.email}` : ""}
          </p>
          <p>
            Ta povezava je namenjena samo vam. Ne delite je — vsebuje podatke o vašem
            naročilu.
          </p>
        </footer>
      </div>
    </div>
  )
}
