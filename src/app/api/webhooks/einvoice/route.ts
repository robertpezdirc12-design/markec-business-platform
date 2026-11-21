import { NextResponse } from "next/server"
import { recordDeliveryFromWebhook } from "@/lib/einvoice/delivery"

export const runtime = "nodejs"

/**
 * FAZA 3.2 — povratni webhook ponudnika e-pošiljke.
 *
 * Ponudnik javi telematsko dostavo (DELIVERED) ali vsebinsko zavrnitev
 * (REJECTED). Podpis preveri `provider.verifyWebhook` (certifikatni kanal =
 * realen podpis; Direct = idempotency-key v headerju). Vsak nezaupljiv klic
 * vrne 4xx brez učinka na podatke.
 *
 * Body: `{ providerMessageId: string, status: "DELIVERED" | "REJECTED", message?: string }`
 * Header: `x-einvoice-signature` (obvezen) — za Direct kanal mora biti prisoten
 * (ne nujno kriptografsko močan), kar prepreči naključne botne pozive.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const signature = req.headers.get("x-einvoice-signature")
  if (!signature) {
    return NextResponse.json({ ok: false, error: "missing signature header" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }

  const b = body as { providerMessageId?: unknown; status?: unknown; message?: unknown }
  const providerMessageId = typeof b.providerMessageId === "string" ? b.providerMessageId : null
  const status =
    b.status === "DELIVERED" || b.status === "REJECTED" ? (b.status as "DELIVERED" | "REJECTED") : null

  if (!providerMessageId || !status) {
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 })
  }

  const res = await recordDeliveryFromWebhook({
    providerMessageId,
    status,
    signature,
  })

  if (!res.ok) {
    const statusCode = res.error === "invalid signature" ? 401 : 400
    return NextResponse.json({ ok: false, error: res.error }, { status: statusCode })
  }

  return NextResponse.json({ ok: true, changed: res.changed, status })
}