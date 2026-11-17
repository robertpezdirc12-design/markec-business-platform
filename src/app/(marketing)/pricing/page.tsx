import type { Metadata } from "next"
import Link from "next/link"
import { listPlans } from "@/lib/plans/registry"

export const metadata: Metadata = {
  title: "Cene | Poslovna platforma",
  description:
    "Izberite paket, ki ustreza vašemu podjetju. BREZPLAČNO za začetek; PRO za rastoča podjetja; SCALE, ko vas nič ne omejuje.",
  // SEO (audit 2026-11): self-referencirajoč canonical — root layout je
  // prej vse strani usmerjal na domačo stran.
  alternates: { canonical: "/pricing" },
}

function Checkmark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" className="fill-primary/10" />
      <path
        d="M5 8.2 7.1 10.3 11 6.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** EUR centi → oblikovan zapis (npr. 1900 → "19 €"). */
function eur(cents: number): string {
  const n = cents / 100
  // Celozneske cene brez decimalk, sicer 2 decimalki.
  return Number.isInteger(n)
    ? `${n} €`
    : `${n.toFixed(2)} €`
}

export default function PricingPage() {
  const plans = listPlans()
  const hasFree = plans.some((p) => p.priceMonthly === 0)

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="text-primary-text mb-3 text-sm font-medium uppercase tracking-wide">
            Cene, brez skritih stroškov
          </p>
          <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
            Izberite paket za vaše podjetje
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-sm sm:text-base">
            Svojo spletno stran, rezervacije in trgovino začnite brezplačno. Nadgradite, ko
            potrebujete več — kadar koli, brez obveznosti.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid gap-6 sm:grid-cols-3">
          {plans.map((plan) => {
            const isFree = plan.priceMonthly === 0
            const highlighted = plan.id === "pro"
            return (
              <div
                key={plan.id}
                className={
                  "flex flex-col rounded-2xl border p-6 shadow-sm " +
                  (highlighted
                    ? "border-primary-text bg-card relative"
                    : "bg-card")
                }
              >
                {highlighted && (
                  <span className="bg-primary-text text-primary-foreground absolute top-0 right-6 -translate-y-1/2 rounded-full px-3 py-0.5 text-xs font-semibold">
                    Priporočeno
                  </span>
                )}

                <p className="text-foreground text-sm font-semibold uppercase tracking-wide">
                  {plan.label}
                </p>
                <p className="text-muted-foreground mt-2 min-h-10 text-sm">
                  {plan.description.sl}
                </p>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-foreground text-4xl font-bold">
                    {eur(plan.priceMonthly)}
                  </span>
                  <span className="text-muted-foreground text-sm">/ mesec</span>
                </div>
                {isFree && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {hasFree ? "za vedno · brez kartice" : "za začetek"}
                  </p>
                )}

                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature.sl} className="flex items-start gap-2 text-sm">
                      <span className="text-primary-text mt-0.5 shrink-0">
                        <Checkmark />
                      </span>
                      <span>{feature.sl}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  <Link
                    href={isFree ? "/register" : "/start"}
                    className={
                      "inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors " +
                      (highlighted
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "border border-input hover:bg-accent bg-transparent")
                    }
                  >
                    {isFree ? "Začni brezplačno" : "Izberi " + plan.label}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        {/* Note */}
        <p className="text-muted-foreground mx-auto mt-10 max-w-xl text-center text-xs">
          Cene so v evrih in vključujejo DDV. Pakete lahko kadar koli nadgradite ali prekličete;
          vaši podatki ostanejo vedno ohranjeni.
        </p>
      </div>
    </div>
  )
}