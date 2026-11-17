// ============================================================
// PLATFORM FOOTER (marketplace + marketinške strani)
// Popravljeno 2026-11-17 (audit): prejšnja različica je vsebovala
// 15 povezav na neobstoječe strani (/o-nas, /blog, /kariera, /gdpr …),
// 5 socialnih ikon na "#", dve trgovini na "#", nedelujoč obrazec
// za novice in izmišljen telefon. Pravilo projekta je: NI lažnih
// podatkov in NI gumbov, ki ne naredijo ničesar — zato je tu samo
// tisto, kar v platformi res obstaja.
// ============================================================

import Link from "next/link"

// Trgovini se prikažeta SAMO, ko sta resnično nastavljeni (mobilne
// aplikacije še ni). Brez vrednosti => bloka ni, namesto mrtvega linka.
const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? ""
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? ""
const hasStoreLinks = APP_STORE_URL !== "" || PLAY_STORE_URL !== ""

const footerColumns = [
  {
    title: "Platforma",
    links: [
      { name: "Poišči storitev", href: "/podjetja" },
      { name: "Cenik", href: "/pricing" },
      { name: "Za podjetja", href: "/za-podjetja" },
      { name: "Začni brezplačno", href: "/start" },
    ],
  },
  {
    title: "Vaš račun",
    links: [
      { name: "Prijava", href: "/login" },
      { name: "Registracija", href: "/register" },
      { name: "Moji termini", href: "/my-appointments" },
    ],
  },
  {
    title: "Pravno",
    links: [
      { name: "Pogoji uporabe", href: "/terms" },
      { name: "Zasebnost", href: "/privacy" },
      { name: "Piškotki", href: "/cookies" },
    ],
  },
]

export function EnhancedFooter() {
  return (
    <footer className="bg-muted/30">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-lg font-bold">
                M
              </div>
              <span className="text-xl font-bold">MARKEC</span>
            </Link>

            <p className="text-muted-foreground mt-4 max-w-sm">
              Platforma za rezervacijo lokalnih storitev. Odkrijte in
              rezervirajte v nekaj klikih.
            </p>

            {/* Store badges — samo z resničnima povezavama */}
            {hasStoreLinks && (
              <div className="mt-6 flex gap-3">
                {APP_STORE_URL !== "" && (
                  <a
                    href={APP_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:border-primary bg-background flex items-center gap-2 rounded-lg border px-4 py-2 transition-all hover:shadow-md"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                    <div>
                      <p className="text-muted-foreground text-[10px]">
                        Prenesite na
                      </p>
                      <p className="text-xs font-semibold">App Store</p>
                    </div>
                  </a>
                )}
                {PLAY_STORE_URL !== "" && (
                  <a
                    href={PLAY_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:border-primary bg-background flex items-center gap-2 rounded-lg border px-4 py-2 transition-all hover:shadow-md"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                    </svg>
                    <div>
                      <p className="text-muted-foreground text-[10px]">
                        Prenesite na
                      </p>
                      <p className="text-xs font-semibold">Google Play</p>
                    </div>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Link Columns */}
          {footerColumns.map((column) => (
            <div key={column.title}>
              <h3 className="mb-4 font-semibold">{column.title}</h3>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
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
            <p className="text-muted-foreground text-sm">
              © {new Date().getFullYear()} MARKEC. Vse pravice pridržane.
            </p>

            <div className="flex items-center gap-6">
              <Link
                href="/terms"
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                Pogoji
              </Link>
              <Link
                href="/privacy"
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                Zasebnost
              </Link>
              <Link
                href="/cookies"
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                Piškotki
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
