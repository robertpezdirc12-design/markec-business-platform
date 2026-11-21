import { NextResponse } from "next/server"
import { recordDeliveryFromWebhook } from "@/lib/einvoice/delivery"
import { SIGNATURE_HEADER, TIMESTAMP_HEADER } from "@/lib/einvoice/webhook-hmac"

export const runtime = "nodejs"

/**
 * FAZA 3.2 (varnost) — povratni webhook ponudnika e-pošiljke.
 *
 * Ponudnik javi telematsko dostavo (DELIVERED) ali vsebinsko zavrnitev
 * (REJECTED). Podpis preveri `provider.verifyWebhook`:
 *   • Direct kanal — HMAC-SHA256 s kanalno skrivnostjo, nad SUROVIMI bajti
 *     telesa (`x-einvoice-signature`), s časovno omejitvijo
 *     (`x-einvoice-timestamp`) in zaščito pred ponovitvijo.
 *   • Certifikatni kanal (UJP/PEPPOL) — trenutno zavrnjen (fail-closed), dokler
 *     dokumentirano podpisno preverjanje ni implementirano.
 * Vsak nezaupljiv klic vrne 4xx BREZ učinka na podatke.
 *
 * Ključno: `rawBody` so DEJANSKO prejeti bajti (Buffer), ne ponovno
 * sestavljen `JSON.stringify(input)`. To preprečuje vsakršno neskladje med
 * podpisanim in razčlenjenim telesom (A5).
 *
 * Body: `{ channel: string, providerMessageId: string, status: "DELIVERED" | "REJECTED", message?: string }`
 * Headers: `x-einvoice-signature` (obvezen), `x-einvoice-timestamp` (obvezen, ISO-8601)
 */
export async function POST(req: Request): Promise<NextResponse> {
  const signature = req.headers.get(SIGNATURE_HEADER)
  const timestamp = req.headers.get(TIMESTAMP_HEADER)
  if (!signature || !timestamp) {
    return NextResponse.json(
      { ok: false, error: "missing signature or timestamp header" },
      { status: 400 }
    )
  }

  // A5 — preberi surove bajte telesa, da lahko podpis preverimo nad njimi.
  let rawBody: Buffer
  try {
    rawBody = Buffer.from(await req.arrayBuffer())
  } catch {
    return NextResponse.json({ ok: false, error: "unreadable body" }, { status: 400 })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody.toString("utf8"))
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }

  const b = parsed as {
    organizationId?: unknown
    channel?: unknown
    providerMessageId?: unknown
    status?: unknown
    message?: unknown
  }
  // TOČKA 2 — `organizationId` je le USMERJEVALNIK na skrivnost org+kanal, NE
  // sam po sebi zaupanja vredna identifikacija. Dejanska organizacijska
  // pripadnost je potrjena šele z veljavnim HMAC podpisom, vezanim na tisto
  // organizacijo in kanal (glej recordDeliveryFromWebhook). Brez organizationId
  // ne moremo izbrati prave skrivnosti → fail-closed (400).
  const organizationId = typeof b.organizationId === "string" && b.organizationId.length > 0 ? b.organizationId : null
  const channel = typeof b.channel === "string" && b.channel.length > 0 ? b.channel : null
  const providerMessageId = typeof b.providerMessageId === "string" ? b.providerMessageId : null
  const status =
    b.status === "DELIVERED" || b.status === "REJECTED" ? (b.status as "DELIVERED" | "REJECTED") : null

  if (!organizationId || !channel || !providerMessageId || !status) {
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 })
  }

  const res = await recordDeliveryFromWebhook({
    organizationId,
    channel,
    providerMessageId,
    status,
    signature,
    timestamp,
    rawBody,
  })

  if (!res.ok) {
    const statusCode = res.error === "invalid signature" ? 401 : res.error === "unknown invoice" ? 404 : 400
    return NextResponse.json({ ok: false, error: res.error }, { status: statusCode })
  }

  return NextResponse.json({ ok: true, changed: res.changed, channel, status })
}