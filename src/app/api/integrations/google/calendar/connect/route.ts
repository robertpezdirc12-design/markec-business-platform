// ============================================================
// POVEZAVA Z GOOGLE KOLEDARJEM — 1. korak (preusmeritev h Googlu)
//
// Tu se NE zgodi nič trajnega: preverimo sejo in dovoljenje, ustvarimo
// podpisan `state` in uporabnika pošljemo na Googlovo soglasje.
// Povezava se zapiše šele v callbacku, ko Google vrne `code`.
// ============================================================

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { auth } from "@/lib/auth/auth"
import { resolveSessionOrganization } from "@/lib/auth/guards"
import { getEffectivePermissions } from "@/lib/permissions/effective"
import { resolveAppUrl } from "@/lib/seo"
import { buildAuthUrl, googleCalendarConfigured } from "@/lib/calendar/google"
import { STATE_COOKIE, calendarStateConfigured, createState } from "@/lib/calendar/state"

export const runtime = "nodejs"

function back(reason: string): NextResponse {
  return NextResponse.redirect(new URL(`/dashboard/settings?calendar=${reason}`, resolveAppUrl()))
}

export async function GET(): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", resolveAppUrl()))
  }

  const org = await resolveSessionOrganization(session)
  if (!org) return back("no-org")

  const permissions = await getEffectivePermissions(session.user.id, org.id)
  if (!permissions.includes("settings.manage")) return back("permission")

  if (!googleCalendarConfigured()) return back("unconfigured")
  if (!calendarStateConfigured()) return back("unconfigured")

  const state = createState({ org: org.id, user: session.user.id })
  const authUrl = buildAuthUrl(state)
  if (!authUrl) return back("unconfigured")

  const store = await cookies()
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/integrations/google/calendar",
    maxAge: 10 * 60,
  })

  return NextResponse.redirect(authUrl)
}
