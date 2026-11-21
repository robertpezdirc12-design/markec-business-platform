// ============================================================
// F5.5.4.6.4 / Faza 3.2 (varnost) — HMAC-SHA256 podpisovanje povratnih webhookov
// za interni Direct kanal ter skupne pomožne funkcije za varno preverjanje.
//
// Vzorec je enak obstoječim outgoing webhookom (#110): podpis =
// HMAC-SHA256(secret, rawBody) → hex, ki ga primerjamo s headerjem
// `x-einvoice-signature`. Kanal-only skrivnost se NE pošilja v payloadu;
// v `verifyWebhook` jo dostavi `ChannelCfg.credentials.webhookSecret`
// (dešifrirano iz `EInvoiceChannelConfig.encryptedSecret`).
//
// Zaščita pred ponovitvijo (replay): vsaka zahteva mora nositi
// `x-einvoice-timestamp`; dopuščamo le `WEBHOOK_TIMESTAMP_WINDOW_MS`
// zamika. Vse primerjave so časovno varne (timingSafeEqual).
// ============================================================

import { createHmac, timingSafeEqual } from "node:crypto"

/** Največji dopustni zamik med oddanim časom in našim strežniškim časom. */
export const WEBHOOK_TIMESTAMP_WINDOW_MS = 5 * 60 * 1000 // 5 minut

/** Headerja, ki ju Direct kanal pričakuje pri povratnem webhooku. */
export const SIGNATURE_HEADER = "x-einvoice-signature"
export const TIMESTAMP_HEADER = "x-einvoice-timestamp"

/** Konstruira podpis HMAC-SHA256 nad surovim telesom. */
export function signWebhookHmac(secret: string, rawBody: string | Buffer, timestamp: string): string {
  return createHmac("sha256", secret).update(`${timestamp}\n`).update(rawBody).digest("hex")
}

/**
 * Varno preverjanje HMAC-SHA256 nad RAW telesom s časovno omejitvijo.
 * Vrne `true` le, če:
 *   - je skrivnost podana,
 *   - je podpis headerja v obliki `sha256=<hex>` in časovno varne primerjave,
 *   - je `timestamp` v dopustnem zamiku (`WEBHOOK_TIMESTAMP_WINDOW_MS`).
 * Napaka ravnanja s časom (ne-parseable, predaleč v preteklost/prhodnost)
 * pomeni `false` (fail-closed).
 */
export function verifyWebhookHmac(
  secret: string | undefined | null,
  signatureHeader: string | null,
  timestampHeader: string | null,
  rawBody: string | Buffer
): boolean {
  if (!secret || !signatureHeader || !timestampHeader) return false
  if (!signatureHeader.startsWith("sha256=")) return false

  const providedSig = signatureHeader.slice("sha256=".length).trim()
  if (!/^[0-9a-f]{64}$/i.test(providedSig)) return false

  const ts = Date.parse(timestampHeader)
  if (!Number.isFinite(ts)) return false
  const now = Date.now()
  if (Math.abs(now - ts) > WEBHOOK_TIMESTAMP_WINDOW_MS) return false

  const expected = signWebhookHmac(secret, rawBody, timestampHeader)
  const expectedBuf = Buffer.from(expected, "hex")
  const providedBuf = Buffer.from(providedSig, "hex")
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}