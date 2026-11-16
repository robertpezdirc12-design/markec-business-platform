// ============================================================
// ENHANCED FOOTER (Fresha-inspired, superior 2026-11-16)
// Comprehensive footer with social media, app download,
// newsletter, and organized link columns.
// Surpasses Fresha with better organization and more content.
// ============================================================

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
} from "@/components/icons"
import {
  FacebookLogo,
  InstagramLogo,
  LinkedinLogo,
  YoutubeLogo,
  TiktokLogo,
} from "@phosphor-icons/react/dist/ssr"

const footerLinks = {
  company: {
    title: "O MARKEC",
    links: [
      { name: "O nas", href: "/o-nas" },
      { name: "Kariera", href: "/kariera" },
      { name: "Blog", href: "/blog" },
      { name: "Novice", href: "/novice" },
      { name: "Partnerstva", href: "/partnerstva" },
    ],
  },
  business: {
    title: "Za podjetja",
    links: [
      { name: "Cenik", href: "/pricing" },
      { name: "Za partnerje", href: "/za-partnerje" },
      { name: "Plačila", href: "/placila" },
      { name: "Podpora", href: "/podpora" },
      { name: "Status sistema", href: "/status" },
      { name: "API dokumentacija", href: "/api-docs" },
    ],
  },
  customers: {
    title: "Za stranke",
    links: [
      { name: "Razišči podjetja", href: "/podjetja" },
      { name: "Kategorije", href: "/kategorije" },
      { name: "Moji termini", href: "/moji-termini" },
      { name: "Prijava", href: "/login" },
      { name: "Registracija", href: "/register" },
    ],
  },
  legal: {
    title: "Pravno",
    links: [
      { name: "Pogoji uporabe", href: "/terms" },
      { name: "Zasebnost", href: "/privacy" },
      { name: "Piškotki", href: "/cookies" },
      { name: "GDPR", href: "/gdpr" },
      { name: "Pravilnik o zasebnosti", href: "/privacy-policy" },
    ],
  },
}

const socialLinks = [
  { name: "Facebook", icon: <FacebookLogo size={20} />, href: "#" },
  { name: "Instagram", icon: <InstagramLogo size={20} />, href: "#" },
  { name: "LinkedIn", icon: <LinkedinLogo size={20} />, href: "#" },
  { name: "YouTube", icon: <YoutubeLogo size={20} />, href: "#" },
  { name: "TikTok", icon: <TiktokLogo size={20} />, href: "#" },
]

const contactInfo = [
  { icon: <MapPinIcon size={18} />, text: "Ljubljana, Slovenija" },
  { icon: <PhoneIcon size={18} />, text: "+386 1 234 5678" },
  { icon: <EnvelopeIcon size={18} />, text: "info@markec.si" },
]

export function EnhancedFooter() {
  return (
    <footer className="bg-muted/30">
      {/* Newsletter Section */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">
            <div>
              <h3 className="text-2xl font-bold">
                Bodite na tekočem z MARKEC
              </h3>
              <p className="mt-2 text-muted-foreground">
                Naročite se na novice in prejmite ekskluzivne ponudbe.
              </p>
            </div>
            <div className="flex w-full max-w-md gap-3">
              <Input
                type="email"
                placeholder="Vaš e-poštni naslov"
                className="flex-1"
              />
              <Button>Naroči se</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-6">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                M
              </div>
              <span className="text-xl font-bold">MARKEC</span>
            </div>

            <p className="mt-4 text-muted-foreground">
              Platforma za rezervacijo lokalnih storitev. Odkrijte in
              rezervirajte v nekaj klikih.
            </p>

            {/* Contact Info */}
            <div className="mt-6 space-y-3">
              {contactInfo.map((item) => (
                <div
                  key={item.text}
                  className="flex items-center gap-3 text-sm text-muted-foreground"
                >
                  <div className="text-primary">{item.icon}</div>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>

            {/* Social Links */}
            <div className="mt-6 flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  className="flex h-10 w-10 items-center justify-center rounded-full border bg-background transition-all hover:border-primary hover:bg-primary/5 hover:shadow-md"
                  aria-label={social.name}
                >
                  {social.icon}
                </a>
              ))}
            </div>

            {/* App Download */}
            <div className="mt-6">
              <p className="mb-3 text-sm font-medium">Prenesite aplikacijo</p>
              <div className="flex gap-3">
                <a
                  href="#"
                  className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 transition-all hover:border-primary hover:shadow-md"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Prenesite na</p>
                    <p className="text-xs font-semibold">App Store</p>
                  </div>
                </a>
                <a
                  href="#"
                  className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 transition-all hover:border-primary hover:shadow-md"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                  </svg>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Prenesite na</p>
                    <p className="text-xs font-semibold">Google Play</p>
                  </div>
                </a>
              </div>
            </div>
          </div>

          {/* Link Columns */}
          {Object.values(footerLinks).map((column) => (
            <div key={column.title}>
              <h3 className="mb-4 font-semibold">{column.title}</h3>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              © 2026 MARKEC. Vse pravice pridržane.
            </p>

            <div className="flex items-center gap-6">
              <Link
                href="/terms"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Pogoji
              </Link>
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Zasebnost
              </Link>
              <Link
                href="/cookies"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Piškotki
              </Link>
              <button className="text-sm text-muted-foreground hover:text-foreground">
                🌐 slovenščina (SI)
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}