/**
 * P1 #107 — SLUG STORITVE (in drugih vsebin salona).
 *
 * Napaka, ki jo je lastnica videla v produkciji: javni naslov storitve je
 * bil `barvanje-koreninbarvanje-korenin` — obrazec je ob vsaki spremembi
 * imena POVOZIL ročno vnesen slug z avtomatskim, vtipkano besedilo pa se
 * je pripelo na obstoječo vrednost. Posledica: grd URL, ki se ga ne da
 * popraviti brez ročnega posega v bazo.
 *
 * Pravila:
 *  - `slugifyService` je edini vir resnice za obliko sluga (male črke,
 *    brez šumnikov, pomišljaji) — enako kot `slugify` za organizacije.
 *  - `uniqueServiceSlug` zagotovi unikatnost ZNOTRAJ organizacije:
 *    `barvanje-korenin`, `barvanje-korenin-2`, `barvanje-korenin-3` …
 *    (prej je druga storitev z istim imenom dobila podvojen slug in
 *    stran `/services/<slug>` je prikazala napačno storitev).
 */

/** Pretvori poljuben tekst v varen slug (č/š/ž → c/s/z, presledki → -). */
export function slugifyService(input: string, maxLength = 60): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // odstrani diakritiko (č → c, š → s, ž → z)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "")
}

/**
 * Vrne slug, ki je znotraj organizacije še prost.
 *
 * @param base     želeni slug (že normaliziran ali surov)
 * @param isTaken  async preverjanje zasedenosti (Prisma poizvedba)
 * @param fallback uporabljeno, če je osnova prazna (npr. ime samo v cirilici)
 */
export async function uniqueServiceSlug(
  base: string,
  isTaken: (slug: string) => Promise<boolean>,
  fallback = "storitev"
): Promise<string> {
  const root = slugifyService(base) || fallback
  if (!(await isTaken(root))) return root

  // 2..50 — dovolj za realno število enako poimenovanih storitev
  for (let i = 2; i <= 50; i++) {
    const candidate = `${root}-${i}`
    if (!(await isTaken(candidate))) return candidate
  }
  // Skrajni izhod: nikoli ne vrnemo podvojenega sluga (raje unikaten žeton)
  return `${root}-${Date.now().toString(36)}`
}
