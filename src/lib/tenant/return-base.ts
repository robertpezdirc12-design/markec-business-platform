import { headers } from "next/headers"
import { getCustomDomainOrg, getTrustedOrgSlug } from "@/lib/tenant"
import { orgPath } from "@/lib/org-path"

// ============================================================
// VRNITVENI NASLOV NAJEMNIKA (za Stripe success/cancel URL)
//
// Izdvojeno iz actions/stripe.ts, ker ga potrebuje tudi plačilo depozita
// na delovnem naročilu (actions/work-order-public.ts). Pravila ostajajo
// enaka:
//   - izvor = dejanski izvor zahtevka (x-forwarded-host/proto) — pravilno
//     tudi pri dev dvojicah portov, brez .env petljanja;
//   - preverjena custom domena servi najemnika na GOLIH poteh (/s/<slug>
//     je tam po načrtu 404 — proxy V-1 host binding);
//   - platforma servi najemnika pod /s/<slug> — to pripono dodamo;
//   - brez request konteksta (kron/test) → env NEXT_PUBLIC_APP_URL.
// ============================================================
export async function tenantReturnBase(): Promise<string> {
  let origin: string | null = null
  try {
    const h = await headers()
    const host = h.get("x-forwarded-host") ?? h.get("host")
    const proto = h.get("x-forwarded-proto") ?? "http"
    if (host) origin = `${proto}://${host}`
  } catch {
    // Brez request konteksta (kron/test) — pade naprej na env.
  }
  if (!origin) return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  try {
    if (await getCustomDomainOrg()) return origin
    const slug = await getTrustedOrgSlug()
    if (slug) return `${origin}${orgPath(slug, "")}`
  } catch {
    // DB ni na voljo — ostane izvor zahtevka.
  }
  return origin
}
