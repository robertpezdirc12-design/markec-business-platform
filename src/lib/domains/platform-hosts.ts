// ============================================================
// PLATFORM HOSTS FROM ENV (issue #102 — F0-S V-1)
//
// Client-safe extraction of the platform host list: the PROXY
// (edge runtime) needs the same host decision as tenant.ts —
// "is this request host a custom domain candidate or the platform
// root?" — to enforce host-based tenant binding (the header must
// never override the host). provider.ts keeps the server-only
// wrapper and delegates here, so the rule can never drift between
// the proxy and the server.
// ============================================================

/**
 * The platform's own hosts (from env). Never throws: blank env simply
 * yields fewer hosts. Hostname only (no port) — matches the
 * hostFromHostHeader output shape.
 */
export function getPlatformHostsFromEnv(): string[] {
  const hosts: string[] = []

  // PLATFORM_HOSTS: eksplicitni seznam (vejica), za STABILNE platformne
  // hoste, ki jih okolje ne pozna samo. Nujno: `VERCEL_URL` je
  // PER-DEPLOYMENT (markec-…-kcvz5guck.vercel.app), zato bi stabilni
  // produkcijski alias (markec-…-designs-projects.vercel.app) obravnavali
  // kot host najemnika → koren platforme 404. Enako velja za lastne do-
  // mene platforme (npr. markec.si, ko bo DNS). Prazno = ni spremembe.
  for (const raw of (process.env.PLATFORM_HOSTS ?? "").split(",")) {
    const host = hostFromEnvValue(raw)
    if (host) hosts.push(host)
  }

  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_URL,
  ]
  for (const candidate of candidates) {
    const host = hostFromEnvValue(candidate)
    if (host) hosts.push(host)
  }
  return hosts
}

/**
 * Normaliziraj vrednost iz okolja v goli hostname (brez sheme, poti in
 * porta) — ista oblika, kot jo vrne `hostFromHostHeader`, da primerjava
 * `isPlatformHost` deluje. Vrne null za prazno/neveljavno vrednost.
 */
function hostFromEnvValue(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  // Samo vrednost s shemo (https://…) gre skozi URL parser. Brez tega bi
  // "markec.si:3008" URL parser razumel kot shemo "markec.si" (hostname
  // prazen) in bi host tiho izginil.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    try {
      // hostname (not host): no port — matches hostFromHostHeader output
      return new URL(trimmed).hostname.toLowerCase() || null
    } catch {
      return null
    }
  }

  // Goli host (VERCEL_URL je brez sheme): odstrani morebitno pot in port.
  const bare = trimmed
    .toLowerCase()
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
  return bare || null
}
