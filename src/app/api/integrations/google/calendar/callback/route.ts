// ============================================================
// POVEZAVA Z GOOGLE KOLEDARJEM — 2. korak (callback)
//
// Preverimo DVE stvari, preden karkoli shranimo:
//   1. podpis in potek `state`-a (ukraden `code` je neuporaben),
//   2. da je state enak piškotku v TEM brskalniku (zahteva se ne more
//      zaključiti v tujem brskalniku).
// Šele nato zamenjamo `code` za žetone in jih shranimo ŠIFRIRANE.
//
// Uporabniku nikoli ne pokažemo Googlovega sporočila o napaki v celoti
// (lahko vsebuje podrobnosti o računu) — le kratko kodo stanja.
// ============================================================

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { auth } from "@/lib/auth/auth"
import { resolveSessionOrganization } from "@/lib/auth/guards"
import { resolveAppUrl } from "@/lib/seo"
import { CALENDAR_SCOPE, exchangeCode, fetchAccountEmail } from "@/lib/calendar/google"
import { saveConnection } from "@/lib/calendar/connection"
import { STATE_COOKIE, verifyState } from "@/lib/calendar/state"

export const runtime = "nodejs"

function back(reason: string): NextResponse {
  return NextResponse.redirect(new URL(`/dashboard/settings?calendar=${reason}`, resolveAppUrl()))
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url)
  const store = await cookies()

  const clearCookie = () => store.delete({ name: STATE_COOKIE, path: "/api/integrations/google/calendar" })

  if (url.searchParams.get("error")) {
    clearCookie()
    return back("denied")
  }

  const code = url.searchParams.get("code")
  const stateParam = url.searchParams.get("state")
  const cookieState = store.get(STATE_COOKIE)?.value ?? null

  if (!code) return back("failed")
  // Constant-time primerjava ni potrebna: gre za javno, kratkoživo
  // vrednost, podpis pa preverimo spodaj.
  if (!stateParam || !cookieState || stateParam !== cookieState) {
    clearCookie()
    return back("state")
  }

  const payload = verifyState(stateParam)
  if (!payload) {
    clearCookie()
    return back("state")
  }

  // Seja mora še vedno veljati IN še vedno kazati na isto organizacijo.
  const session = await auth()
  if (!session?.user) return back("session")
  const org = await resolveSessionOrganization(session)
  if (!org || org.id !== payload.org) {
    clearCookie()
    return back("no-org")
  }

  const tokens = await exchangeCode(code)
  if (!tokens.ok) {
    clearCookie()
    return back("failed")
  }

  // Če Google ne vrne zahtevanega obsega, povezava ne bi delovala —
  // raje pošteno zavrnemo kot da bi shranili neuporaben žeton.
  const granted = tokens.value.scope ?? ""
  if (granted && !granted.includes("calendar.events")) {
    clearCookie()
    return back("scope")
  }

  const accountEmail = await fetchAccountEmail(tokens.value.accessToken)
  await saveConnection({
    organizationId: org.id,
    tokens: { ...tokens.value, scope: tokens.value.scope ?? CALENDAR_SCOPE },
    accountEmail,
  })

  clearCookie()
  return back("connected")
}
