import Link from "next/link"
import { Metadata } from "next"
import {
  ArrowSquareOutIcon,
  EnvelopeSimpleIcon,
  GearIcon,
  GlobeIcon,
  QuestionIcon,
  RocketLaunchIcon,
  WrenchIcon,
} from "@phosphor-icons/react/dist/ssr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Pomoč in podpora",
}

const quickLinks = [
  {
    href: "/dashboard",
    title: "Pregled in začetni koraki",
    description: "Vrnite se na pregled ter dokončajte preostale korake nastavitve.",
    icon: RocketLaunchIcon,
  },
  {
    href: "/dashboard/settings",
    title: "Nastavitve podjetja",
    description: "Posodobite podatke o podjetju, urnik, plačila in druge nastavitve.",
    icon: GearIcon,
  },
  {
    href: "/dashboard/website",
    title: "Urejanje spletne strani",
    description: "Prilagodite vsebino, izgled in objavite spremembe na svoji strani.",
    icon: GlobeIcon,
  },
  {
    href: "/dashboard/services",
    title: "Storitve in ponudba",
    description: "Dodajte ali uredite storitve, cene in trajanja.",
    icon: WrenchIcon,
  },
]

const faqs = [
  {
    q: "Kako objavim svojo stran?",
    a: "Na pregledu preverite, ali so izpolnjeni osnovni podatki (ime, storitve, urnik). Ko je vse pripravljeno, uporabite možnost objave v nastavitvah ali urejevalniku strani.",
  },
  {
    q: "Kje uredim delovni čas in storitve?",
    a: "Delovni čas in poslovne podatke uredite v Nastavitvah, storitve in cene pa v razdelku Storitve.",
  },
  {
    q: "Potrebujem dodatno pomoč?",
    a: "Pišite nam na e-pošto podpore in vključite kratek opis težave ter, če je mogoče, posnetek zaslona.",
  },
]

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <QuestionIcon size={18} weight="duotone" />
          <span className="text-sm font-medium">Pomoč in podpora</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Kako vam lahko pomagamo?</h1>
        <p className="text-muted-foreground">
          Hitra navodila, povezave do ključnih nastavitev in enoten stik za podporo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <EnvelopeSimpleIcon size={20} weight="duotone" />
            Stik s podporo
          </CardTitle>
          <CardDescription>
            Če naletite na težavo ali potrebujete pomoč pri nastavitvi, nam pišite.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            <p>Odgovorimo vam v najkrajšem možnem času.</p>
            <p className="font-medium text-foreground">podpora@markec.si</p>
          </div>
          <Button asChild>
            <a href="mailto:podpora@markec.si?subject=Pomo%C4%8D%20-%20Markec%20nadzorna%20plo%C5%A1%C4%8Da">
              Pišite podpori
              <ArrowSquareOutIcon size={16} className="ml-2" />
            </a>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {quickLinks.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className="block">
              <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/20">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon size={18} weight="duotone" className="text-primary" />
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pogosta vprašanja</CardTitle>
          <CardDescription>Kratek odgovor na najpogostejše korake pri uporabi.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {faqs.map((faq) => (
            <div key={faq.q} className="space-y-1">
              <h3 className="text-sm font-medium">{faq.q}</h3>
              <p className="text-sm text-muted-foreground">{faq.a}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
