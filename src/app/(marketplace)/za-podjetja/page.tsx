import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CalendarIcon,
  UsersIcon,
  CurrencyDollarIcon,
  TrendingUpIcon,
  StarIcon,
  PhoneIcon,
  EnvelopeIcon,
  ClockIcon,
  ShoppingBagIcon,
  SparkleIcon,
} from "@/components/icons"

// ============================================================
// B2B LANDING PAGE (Fresha-inspired 2026-11-16)
// Marketing page for business owners — "Za podjetja" entry.
// Like Fresha's "Fresha za podjetja" page.
// ============================================================

export default function BusinessLandingPage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left: Copy */}
            <div>
              <Badge variant="secondary" className="mb-4">
                ✨ MARKEC za podjetja
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Dopolnite svoje poslovanje z{" "}
                <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
                  najboljšo platformo
                </span>{" "}
                za rezervacije
              </h1>
              <p className="mt-6 text-lg text-muted-foreground">
                Upravljajte termine, stranke, marketing in plačila na enem mestu.
                Priljubljeno med saloni, brivci, wellness studii in zdravniki.
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link href="/register">
                  <Button size="lg" className="px-8">
                    Začnite brezplačno
                    <ArrowRightIcon size={18} className="ml-2" />
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button size="lg" variant="outline" className="px-8">
                    Oglejte si cenik
                  </Button>
                </Link>
              </div>

              {/* Social Proof */}
              <div className="mt-8 flex items-center gap-6">
                <div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <StarIcon
                        key={i}
                        size={18}
                        className="text-amber-400"
                        weight="fill"
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <strong>Odlično 5/5</strong> — več kot 1.250 mnenj
                  </p>
                </div>
                <div className="h-10 w-px bg-border" />
                <div>
                  <p className="text-2xl font-bold">500+</p>
                  <p className="text-sm text-muted-foreground">aktivnih podjetij</p>
                </div>
              </div>
            </div>

            {/* Right: Dashboard Preview */}
            <div className="relative">
              <div className="rounded-2xl border bg-background shadow-2xl">
                {/* Mock Dashboard Header */}
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

                  {/* Staff columns */}
                  <div className="grid grid-cols-3 gap-2">
                    {["Ana", "Maja", "Sara"].map((name, idx) => (
                      <div key={name}>
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                            {name[0]}
                          </div>
                          <span className="text-xs font-medium">{name}</span>
                        </div>
                        {/* Appointment blocks */}
                        <div className="space-y-1">
                          {[
                            { time: "9:00", color: "bg-blue-100 border-blue-300", text: "Striženje" },
                            { time: "10:00", color: "bg-green-100 border-green-300", text: "Barvanje" },
                            { time: "11:00", color: "bg-amber-100 border-amber-300", text: "Masaža" },
                          ].slice(0, idx === 0 ? 3 : idx === 1 ? 2 : 1).map((apt) => (
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

              {/* Floating elements */}
              <div className="absolute -right-4 top-1/4 rounded-lg border bg-background p-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon size={16} className="text-green-500" />
                  <span className="text-xs font-medium">Nova rezervacija</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold">
              Vse kar potrebujete za uspešno poslovanje
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Ena platforma za upravljanje celotnega poslovanja
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <CalendarIcon size={24} />,
                title: "Pametni koledar",
                description: "Upravljajte termine, urnike in razpoložljivost osebja v realnem času.",
                color: "bg-blue-100 text-blue-600",
              },
              {
                icon: <UsersIcon size={24} />,
                title: "Upravljanje strank",
                description: "CRM z zgodovino obiskov, opombami, oznakami in segmentacijo.",
                color: "bg-green-100 text-green-600",
              },
              {
                icon: <ShoppingBagIcon size={24} />,
                title: "Spletna trgovina",
                description: "Prodajajte izdelke prek spletne trgovine z integriranimi plačili.",
                color: "bg-purple-100 text-purple-600",
              },
              {
                icon: <EnvelopeIcon size={24} />,
                title: "Marketing orodja",
                description: "E-pošta, SMS, avtomatizacija, promocije in zvestobe.",
                color: "bg-amber-100 text-amber-600",
              },
              {
                icon: <TrendingUpIcon size={24} />,
                title: "Poročila in analitika",
                description: "Podrobna poročila o prihodkih, strankah in uspešnosti.",
                color: "bg-red-100 text-red-600",
              },
              {
                icon: <CurrencyDollarIcon size={24} />,
                title: "Plačila in računi",
                description: "Sprejemajte plačila, ustvarjajte račune in obračunavajte.",
                color: "bg-teal-100 text-teal-600",
              },
            ].map((feature) => (
              <Card key={feature.title} className="transition-all hover:shadow-md">
                <CardContent className="p-6">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${feature.color}`}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold">Preprost in pregleden cenik</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Izberite paket, ki ustreza vašemu poslovanju
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
            {[
              {
                name: "Osnovni",
                price: "29 €",
                period: "/ mesec",
                description: "Za majhne salone in samostojne podjetnike",
                features: ["Do 5 uporabnikov", "Koledar", "Upravljanje strank", "E-poštna obvestila"],
                cta: "Začnite brezplačno",
                popular: false,
              },
              {
                name: "Profesionalni",
                price: "59 €",
                period: "/ mesec",
                description: "Za rastoče salone in studie",
                features: ["Do 20 uporabnikov", "Vse iz Osnovnega", "Marketing orodja", "Poročila", "Spletna trgovina"],
                cta: "Izberite Profesionalni",
                popular: true,
              },
              {
                name: "Podjetniški",
                price: "99 €",
                period: "/ mesec",
                description: "Za večje salone in verige",
                features: ["Neomejeno uporabnikov", "Vse iz Profesionalnega", "API dostop", "Prednostna podpora", "Prilagoditve"],
                cta: "Kontaktirajte nas",
                popular: false,
              },
            ].map((plan) => (
              <Card
                key={plan.name}
                className={`relative ${plan.popular ? "border-primary shadow-lg" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      Najbolj priljubljeno
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <CheckCircleIcon size={16} className="text-green-500" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/register" className="mt-6 block">
                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold">Kaj pravijo naše stranke</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Več kot 500 podjetij že uporablja MARKEC
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                name: "Ana Novak",
                role: "Lastnica salona",
                company: "Lassana Kozmetični Salon",
                quote: "MARKEC je popolnoma spremenil naše poslovanje. Rezervacije so samodejne, stranke so zadovoljne, prihodki pa so se povečali za 30%.",
                rating: 5,
              },
              {
                name: "Marko Kovač",
                role: "Brivec",
                company: "Barbershop AS",
                quote: "Končno imam vse na enem mestu. Koledar, stranke, marketing — vse deluje brezhibno. Priporočam vsakemu brivcu.",
                rating: 5,
              },
              {
                name: "Maja Horvat",
                role: "Wellness terapevtka",
                company: "Wellness Studio Mira",
                quote: "Najboljša odločitev za moj studio. Spletna trgovina mi je prinesla dodatne prihodke, marketing orodja pa privabljajo nove stranke.",
                rating: 5,
              },
            ].map((testimonial) => (
              <Card key={testimonial.name}>
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center gap-1">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <StarIcon
                        key={i}
                        size={16}
                        className="text-amber-400"
                        weight="fill"
                      />
                    ))}
                  </div>
                  <p className="text-muted-foreground italic">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-medium">
                      {testimonial.name[0]}
                    </div>
                    <div>
                      <p className="font-medium">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {testimonial.role}, {testimonial.company}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="from-primary to-accent bg-linear-to-r py-16 text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">
            Pripravljeni začeti?
          </h2>
          <p className="mt-4 text-lg opacity-90">
            Pridružite se 500+ podjetjem, ki že uporabljajo MARKEC.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/register">
              <Button size="lg" variant="secondary" className="px-8">
                Začnite brezplačno
                <ArrowRightIcon size={18} className="ml-2" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 px-8 text-primary-foreground hover:bg-primary-foreground/10"
              >
                Oglejte si cenik
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm opacity-75">
            Brez kreditne kartice • 14 dni brezplačno • Prekličite kadarkoli
          </p>
        </div>
      </section>
    </div>
  )
}