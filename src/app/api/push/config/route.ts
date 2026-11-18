import { NextResponse } from "next/server"
import { isPushConfigured } from "@/lib/push/core"

/**
 * #108 — javni VAPID konfigurator.
 * Vrne SAMO javni ključ (ni skrivnost — potreben je za subscribe()).
 * Brez nastavljenega push-a vrne configured:false — UI gumb se skrije.
 * Ni auth — gost na /vrsta ga potrebuje pred prijavo.
 */
export async function GET() {
  const configured = isPushConfigured(
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
  return NextResponse.json({
    configured,
    vapidPublicKey: configured ? process.env.VAPID_PUBLIC_KEY! : null,
  })
}
