"use client"

// ============================================================
// B2B SHOWCASE (Fresha-inspired, superior 2026-11-16)
// Business-facing section with dashboard mockup, testimonials,
// and CTA. Surpasses Fresha with better visual design.
// ============================================================

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  
  ArrowRightIcon,
  CheckCircleIcon,
  CalendarIcon,
  UsersIcon,
  CurrencyDollarIcon,
  ShoppingBagIcon,
} from "@/components/icons"
import {
  ChartLineUp,
  Megaphone,
} from "@phosphor-icons/react/dist/ssr"

const features = [
  {
    icon: <CalendarIcon size={24} />,
    title: "Pametni koledar",
    description: "Upravljajte termine, urnike in razpoložljivost v realnem času.",
  },
  {
    icon: <UsersIcon size={24} />,
    title: "Upravljanje strank",
    description: "CRM z zgodovino, opombami, oznakami in segmentacijo.",
  },
  {
    icon: <ShoppingBagIcon size={24} />,
    title: "Spletna trgovina",
    description: "Prodajajte izdelke z integriranimi plačili in dostavo.",
  },
  {
    icon: <Megaphone size={24} />,
    title: "Trženjska orodja",
    description: "E-pošta, SMS, avtomatizacija, promocije in zvestoba.",
  },
  {
    icon: <ChartLineUp size={24} />,
    title: "Poročila in analitika",
    description: "Podrobna poročila o prihodkih, strankah in uspešnosti.",
  },
  {
    icon: <CurrencyDollarIcon size={24} />,
    title: "Plačila in računi",
    description: "Sprejemajte plačila, ustvarjajte račune in obračunavajte.",
  },
]

// Audit 2026-11-17: tu je bil seznam IZMIŠLJENIH strank ("Ana Novak,
// Lassana Kozmetični Salon", "+30% prihodkov" …). Platforma takih strank
// nima, zato so izjave odstranjene; na njihovem mestu so preverljiva
// dejstva o izdelku.
const platformFacts = [
  "Spletna stran, rezervacije in trgovina v enem računu",
  "Urejanje brez kodiranja — cene, slike in besedila sami",
  "Podatki gostujejo v EU; plačila prek vašega Stripe računa",
]

export function B2BShowcase() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-background via-muted/20 to-background py-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-16 text-center">
          <Badge variant="secondary" className="mb-4">
            ✨ MARKEC za podjetja
          </Badge>

          <h2 className="text-3xl font-bold sm:text-4xl lg:text-5xl">
            Dopolnite svoje poslovanje z{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              najboljšo platformo
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-lg text-muted-foreground">
            Upravljajte termine, stranke, marketing in plačila na enem mestu.
            Priljubljeno med saloni, brivci, wellness studii in zdravniki.
          </p>
        </div>

        {/* Features Grid */}
        <div className="mb-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border bg-background p-6 transition-all hover:shadow-lg hover:-translate-y-1"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <div className="text-primary">{feature.icon}</div>
              </div>
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Dashboard Mockup + Testimonials */}
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Dashboard Mockup */}
          <div className="relative">
            <div className="rounded-2xl border bg-background shadow-2xl">
              {/* Mock Header */}
              <div className="flex items-center justify-between border-b p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                    M
                  </div>
                  <span className="font-semibold">MARKEC</span>
                </div>
                <div className="flex gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                </div>
              </div>

              {/* Mock Calendar */}
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">Koledar</h3>
                  <Badge variant="outline">Danes</Badge>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {["Ana", "Maja", "Sara"].map((name, idx) => (
                    <div key={name}>
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                          {name[0]}
                        </div>
                        <span className="text-xs font-medium">{name}</span>
                      </div>
                      <div className="space-y-1">
                        {[
                          { time: "9:00", color: "bg-blue-100 border-blue-300", text: "Striženje" },
                          { time: "10:00", color: "bg-green-100 border-green-300", text: "Barvanje" },
                          { time: "11:00", color: "bg-amber-100 border-amber-300", text: "Masaža" },
                        ]
                          .slice(0, idx === 0 ? 3 : idx === 1 ? 2 : 1)
                          .map((apt) => (
                            <div
                              key={apt.time}
                              className={`rounded border-l-2 p-1.5 text-[10px] ${apt.color}`}
                            >
                              <p className="font-medium">{apt.time}</p>
                              <p className="text-muted-foreground">{apt.text}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mock Stats */}
              <div className="border-t p-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Prihodki", value: "4.250 €", icon: <CurrencyDollarIcon size={14} /> },
                    { label: "Termini", value: "28", icon: <CalendarIcon size={14} /> },
                    { label: "Stranke", value: "185", icon: <UsersIcon size={14} /> },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center">
                      <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                        {stat.icon}
                      </div>
                      <p className="text-sm font-bold">{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating Elements */}
            <div className="absolute -right-4 top-1/4 rounded-lg border bg-background p-3 shadow-lg">
              <div className="flex items-center gap-2">
                <CheckCircleIcon size={16} className="text-green-500" />
                <span className="text-xs font-medium">Nova rezervacija</span>
              </div>
            </div>
          </div>

          {/* Testimonials */}
          <div>
            {/* Preverljiva dejstva (prej: "5/5 na Capterra / 1250 mnenj"
                in izmišljene stranke — platforma ni na Capterru). */}
            <div className="mb-8">
              <p className="text-2xl font-bold">Kaj dobite</p>
              <p className="text-muted-foreground">
                Brez obljub, ki jih ne moremo dokazati.
              </p>
            </div>

            <div className="space-y-4">
              {platformFacts.map((fact) => (
                <div
                  key={fact}
                  className="flex items-start gap-3 rounded-xl border bg-background p-4"
                >
                  <CheckCircleIcon
                    size={20}
                    className="mt-0.5 shrink-0 text-green-500"
                  />
                  <p className="text-sm text-muted-foreground">{fact}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <Button asChild size="lg" className="gap-2">
            <Link href="/register">
              Začnite brezplačno
              <ArrowRightIcon size={18} />
            </Link>
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            Brez kreditne kartice • 14 dni brezplačno • Prekličite kadarkoli
          </p>
        </div>
      </div>
    </section>
  )
}