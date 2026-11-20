// ============================================================
// F5.5.4.6.4 — KONKRETNI PONUDNIKI E-POTI (adapterji pošiljanja).
//
// Dopolnjuje pogodbo v channel.ts z dejanskim omrežnim izhodom. model vsebuje
// DVA adapterja:
//   • DirectHttpProvider  — generic "direct" HTTP POST arhiviranega XML na
//     organizacijski `providerEndpoint` (za B2B neposredne integracije ali
//     SaaS posrednike). Idempotenca preko `Idempotency-Key` (= eInvoice.id),
//     integriteta preko `X-EInvoice-Sha256` glave.
//   • UnconfiguredProvider — varna mirovalna "oddaja" za kanal, ki še nima
//     končne točke/poverilnic; nikoli ne pošlje, vrne FAILED z jasnim opisom.
//
// Vsi klici so max 2 × retry z eksponentnim backoffom iz channel.ts.
// ============================================================

import {
  type EInvoiceProvider,
  type SubmissionResult,
  type DeliveryStatus,
  type DeliveryState,
  type ChannelCfg,
  type SubmitPayload,
  MAX_RETRIES,
  retryDelayMs,
} from "./channel"

/** Vedno anajdi trenutni globalni fetch (testabilno; brez enkratne zamrznitve). */
function getGlobalFetch(): typeof fetch {
  const f = (globalThis as { fetch?: typeof fetch }).fetch
  return f ?? (async () => new Response(null, { status: 501 } as ResponseInit))
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}

/**
 * Generic "direct" HTTP ponudnik. Pošlje nespremenljivi XML na
 * `channelCfg.providerEndpoint` kot POST (Content-Type: application/xml),
 * z glavami za idempotenco in integriteto. Ta adapter je osnovna
 * implementacija — stranke, ki potrebujejo UJP/PEPPOL AP certifikatno hrbtenico,
 * si dodajo svoj provider z istim vmesnikom.
 */
export class DirectHttpProvider implements EInvoiceProvider {
  readonly kind = "SAAS_PARTNER" as const
  readonly label = "Neposredna HTTP pot"
  readonly testMode: boolean

  constructor(testMode = false) {
    this.testMode = testMode
  }

  async submit(orgId: string, cfg: ChannelCfg, payload: SubmitPayload): Promise<SubmissionResult> {
    if (!cfg.providerEndpoint || !/^https?:\/\//i.test(cfg.providerEndpoint)) {
      return {
        accepted: false,
        providerMessageId: null,
        state: "FAILED",
        technicalOnly: false,
        errors: ["CHANNEL_NOT_READY: providerEndpoint ni nastavljen za kanal."],
      }
    }

    const errors: string[] = []
    let lastStatus = 0
    let lastText = ""

    // Retry do MAX_RETRIES za začasne (5xx) napake; 4xx ne retryarno.
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await getGlobalFetch()(cfg.providerEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            Accept: "application/json, application/xml",
            "Idempotency-Key": payload.einvoiceId,
            "X-EInvoice-Sha256": payload.xmlSha256,
            "X-EInvoice-Org": orgId,
            "X-EInvoice-Api-Key": cfg.credentials?.apiKey ?? "",
          },
          body: payload.xml,
        })
        lastStatus = res.status
        lastText = (await safeText(res)).slice(0, 500)

        if (res.status >= 200 && res.status < 300) {
          const providerId = res.headers.get("x-provider-message-id") ?? null
          return {
            accepted: true,
            providerMessageId: providerId,
            state: "SUBMITTED",
            technicalOnly: true, // HTTP 2xx = tehnično sprejeto; vsebinsko potrditev daje pozneje webhook/polling
            errors: [],
          }
        }
        if (res.status >= 400 && res.status < 500) {
          // Stalna napaka — no retry.
          errors.push(`HTTP ${res.status}: ${lastText || "client error"}`)
          break
        }
        // 5xx — retry kratki backoff.
        errors.push(`HTTP ${res.status}: ${lastText || "server error"}`)
        if (attempt < MAX_RETRIES) await sleep(retryDelayMs(attempt))
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(`NETWORK: ${msg}`)
        if (attempt < MAX_RETRIES) await sleep(retryDelayMs(attempt))
      }
    }

    return {
      accepted: false,
      providerMessageId: null,
      state: "FAILED",
      technicalOnly: false,
      errors: errors.length ? errors : [`HTTP ${lastStatus}`],
    }
  }

  /** Brez webhook konca vrača polling stanje; konkretni posredniki ga nadgradijo. */
  async status(
    _orgId: string,
    _cfg: ChannelCfg,
    providerMessageId: string
  ): Promise<DeliveryStatus> {
    return {
      state: "SUBMITTED",
      providerStatus: providerMessageId ? "pending" : "unmapped",
      timestamp: new Date().toISOString(),
      message: null,
    }
  }

  verifyWebhook(
    _orgId: string,
    _cfg: ChannelCfg,
    _signatureHeader: string | null,
    _rawBody: string | Buffer
  ): boolean {
    // Direct kanal nima trdnih podpisov; tránost opremo na idempotency-key.
    return true
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ""
  }
}

/**
 * Varna mirovalna oddaja za nekonfiguriran kanal. Nikoli ne pošlje omrežja —
 * vrne FAILED z opisom, kaj manjka. Preprečuje tiho izgubo pošiljk.
 */
export class UnconfiguredProvider implements EInvoiceProvider {
  readonly kind = "SAAS_PARTNER" as const
  readonly label = "Nekonfiguriran kanal"
  readonly testMode = true

  async submit(
    _orgId: string,
    _cfg: ChannelCfg,
    _payload: SubmitPayload
  ): Promise<SubmissionResult> {
    return {
      accepted: false,
      providerMessageId: null,
      state: "FAILED",
      technicalOnly: false,
      errors: ["CHANNEL_UNCONFIGURED: kanal nima nastavljene ponudniške poti (providerEndpoint)."],
    }
  }

  async status(
    _orgId: string,
    _cfg: ChannelCfg,
    _providerMessageId: string
  ): Promise<DeliveryStatus> {
    return { state: "FAILED", providerStatus: "unconfigured", timestamp: new Date().toISOString(), message: null }
  }

  verifyWebhook(
    _orgId: string,
    _cfg: ChannelCfg,
    _signatureHeader: string | null,
    _rawBody: string | Buffer
  ): boolean {
    return false
  }
}

/**
 * Registry preslika kanal-vrsto v ponudnika. Trenutno poznamo "direct"
 * (generic HTTP). "ujp" in "peppol" še nimata certifikatne implementacije —
 * do tedaj se obnašajo kot UnconfiguredProvider, da UI ne laže o oddaji.
 */
export function buildProvider(channel: string): EInvoiceProvider {
  switch (channel) {
    case "direct":
      return new DirectHttpProvider()
    case "ujp":
    case "peppol":
    default:
      return new UnconfiguredProvider()
  }
}