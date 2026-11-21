// ============================================================
// F5.5.4.6.4 — POGODBA PONUDNIKA E-POTI (abstrakcija kanala).
//
// To NI dejansko pošiljanje. Truka določa vmesnik, ki ga mora implementirati
// vsak ponudnik (UJP, PEPPOL AP, SaaS partner), plus skupno logiko idempotence,
// retryjev, webhook verifikacije in preslikave v `EInvoiceDeliveryEvent`.
//
// Stanja dostave (ločimo TEHNIČNO dostavo od VSEBINSKEGA sprejema):
//   CREATED -> VALIDATED -> SUBMITTED (accept) -> DELIVERED (technical) | REJECTED
//   SUBMITTED -> POLLING/WEBHOOK -> DELIVERED | REJECTED (business) | FAILED (technical)
// ============================================================

export type DeliveryState =
  | "CREATED"        // XML ustvarjen (arhiv)
  | "VALIDATED"      // uradna/mat expertsko validacija OK
  | "SUBMITTED"      // posredovano ponudniku (tehnično sprejeto)
  | "DELIVERED"      // dostavljeno prejemniku (tehnično potrjeno)
  | "REJECTED"       // vsebinsko zavrnjeno (ponudnik/prejemnik)
  | "FAILED"         // tehnična/neprocesirana napaka
  | "CANCELLED"

export interface SubmissionResult {
  /** zgodovinski event kind (brez preteklosti lažno) */
  accepted: boolean
  providerMessageId: string | null
  state: DeliveryState
  /** tehnično sprejeto (HTTP 2xx) vendar še ni vsebinsko potrjeno */
  technicalOnly: boolean
  errors: string[]
}

export interface DeliveryStatus {
  state: DeliveryState
  providerStatus: string
  timestamp: string
  message: string | null
}

/**
 * Kontrakt vsakega ponudnika. Zaradi multi-tenant varnosti je VSAKA klic se
 * opravi v kontekstu `orgId`, nikoli globalno.
 */
export interface EInvoiceProvider {
  readonly kind: "UJP" | "PEPPOL_AP" | "SAAS_PARTNER"
  readonly label: string
  readonly testMode: boolean

  /** Pošlji e-račun. `idempotencyKey` = eInvoice.id (ali sha256) — ponudnik mora deduplicirati. */
  submit(orgId: string, channelCfg: ChannelCfg, payload: SubmitPayload): Promise<SubmissionResult>

  /** Vrni status dostave (polling ali po webhook sprožilcu). */
  status(orgId: string, channelCfg: ChannelCfg, providerMessageId: string): Promise<DeliveryStatus>

  /** Preveri podpis/webhook pošiljatelja; vrne true le za legit – zaščita pred podtujitvijo. */
  verifyWebhook(
    orgId: string,
    channelCfg: ChannelCfg,
    signatureHeader: string | null,
    timestampHeader: string | null,
    rawBody: string | Buffer
  ): boolean
}

/** Neobčutljiva konfiguracija kanala (kar je dovoljeno shraniti v DB). */
export interface ChannelCfg {
  id: string
  organizationId: string
  channel: string        // "ujp" | "peppol" | "saas"
  providerEndpoint: string | null
  /** dešifrirane poverilnice NASTAVI KLIČ iz secrets.ts; NE shrani čistih. */
  credentials: Record<string, string>
  config: Record<string, unknown>
}

/** Vhod za pošiljanje — determinističen iz arhiviranega e-Invoice. */
export interface SubmitPayload {
  einvoiceId: string
  organizationId: string
  docCode: string
  format: string
  xml: string             // originalni (nespremenljiv) XML
  xmlSha256: string
  recipientId?: string    // prejemnikov PEPPOL/ICD id ali davčna
  creditReference?: string | null
}

/** Konstanta: največ retryjev pod tehnično napako. */
export const MAX_RETRIES = 3

/** Naključni eksponentni backoff (ms): 1s,2s,4s + jitter. */
export function retryDelayMs(attempt: number): number {
  const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000)
  return Math.floor(delay + Math.random() * 250)
}

/**
 * Validira vse potrebe polja, preden se poda ponudniku — pomaga preprečiti
 * pošiljanje praznih/necelovitih payloadov.
 */
export function validateSubmitPayload(p: SubmitPayload): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!p.einvoiceId) errors.push("manjka einvoiceId")
  if (!p.organizationId) errors.push("manjka organizationId")
  if (!p.docCode) errors.push("manjka docCode")
  if (!p.xml || p.xml.trim().length === 0) errors.push("manjka XML")
  if (!p.xmlSha256 || !/^[0-9a-f]{64}$/i.test(p.xmlSha256)) errors.push("manjka veljaven xmlSha256")
  if (!p.recipientId) errors.push("manjka recipientId (`EInvoice/recipientId`)")
  return { ok: errors.length === 0, errors }
}