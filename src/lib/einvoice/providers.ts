// ============================================================
// F5.5.4.6.4 — KONKRETNI PONUDNIKI E-POTI (adapterji pošiljanja).
//
// Dopolnjuje pogodbo v channel.ts z dejanskim omrežnim izhodom. model vsebuje
// TRI adapterje:
//   • DirectHttpProvider  — generic "direct" HTTP POST arhiviranega XML na
//     organizacijski `providerEndpoint` (za B2B neposredne integracije ali
//     SaaS posrednike). Idempotenca preko `Idempotency-Key` (= eInvoice.id),
//     integriteta preko `X-EInvoice-Sha256` glave.
//   • CertHttpProvider    — mutual-TLS (X.509 klient certifikat) dostava na
//     UJP/PEPPOL končno točko. Jedro avtentikacije na UJP DK (SIGOV-CA klient
//     cert, S/MIME ovojnica prek UBL/e-SLOG) in PEPPOL AP (AS4/X.509 klient
//     cert prek HTTPS inbound-a). Poverilnice (cert/key/ca/passphrase) se
//     pošlejejo dešifrirane iz ChannelCfg.credentials (nikoli v DB čistih).
//     Za `channel === "ujp"` in `config.mode === "eslog-joint"` se arhivirani
//     UBL wrappr v e-SLOG JointDokument ovojnico pred pošiljanjem.
//   • UnconfiguredProvider — varna mirovalna "oddaja" za kanal, ki še nima
//     končne točke/poverilnic; nikoli ne pošlje, vrne FAILED z jasnim opisom.
//
// Vsi klici so max 2 × retry z eksponentnim backoffom iz channel.ts.
// ------------------------------------------------------------
// POŠTENO O OBSEGU UJP/PEPPOL: gladka pošiljanje na ŽIVI UJP DK / PEPPOL AP
// zahteva (a) veljaven X.509 klient certifikat + private key organizacije
// (SIGOV-CA za UJP, PEPPOL AP cert) in (b) dejanske proizvodne/testne končne
// točke. Ta adapter zagotavlja celotno mTLS-avtenticirano HTTP dostavo +
// e-SLOG JointDokument ovojnico ter (za UJP) XMLDSig podpis ovojnice z org
// ključem (glej xmldsig.ts). Epilog: končno potrditev dokumenta na dejanskem
// kanalu še vedno preveri stranka (podpisna veriga / UJP DK) pred produkcijo.
// ============================================================

import https from "node:https"
import { isIP } from "node:net"
import { URL } from "node:url"

import {
  type EInvoiceProvider,
  type SubmissionResult,
  type DeliveryStatus,
  type ChannelCfg,
  type SubmitPayload,
  MAX_RETRIES,
  retryDelayMs,
} from "./channel"
import { xmlDsigSign } from "./xmldsig"
import { buildAs4Multipart } from "./as4"
import { verifyWebhookHmac } from "./webhook-hmac"
import { assertPublicHttpsUrl, resolveAndVerifyEndpoint } from "./endpoint-validation"

/** Vedno anajdi trenutni globalni fetch (testabilno; brez enkratne zamrznitve). */
function getGlobalFetch(): typeof fetch {
  const f = (globalThis as { fetch?: typeof fetch }).fetch
  const fallback: typeof fetch = async () => new Response(null, { status: 501 } as ResponseInit)
  return f ?? fallback
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

  /**
   * Injektabilni httptransport za Direct. Privzeto `nodeHttpsTransport`.
   * Testi injektirajo mock (namesto da bi kazali na pravo omrežje) — uporaba
   * preverjenega IP-ja poteka VEDNO skozi ta transport, zato je deterministična.
   */
  _directTransport: HttpsTransport = nodeHttpsTransport

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

    // #1318 SSRF-zaščita: endpoint mora biti veljaven JAVEN HTTPS URL (ne
    // private IP, loopback, link-local ali notranje ime) in NE sledi
    // preusmeritvam. Preverimo ob vsakem pošiljanju, ne samo ob shranjevanju
    // (pokrije spremembo po shranjevanju).
    const v = assertPublicHttpsUrl(cfg.providerEndpoint)
    if (!v.ok) {
      return {
        accepted: false,
        providerMessageId: null,
        state: "FAILED",
        technicalOnly: false,
        errors: [`SSRF: ${v.error}`],
      }
    }
    // DNS-rebinding zaščita ob pošiljanju: razrešivo javno ime se ne sme
    // razrešiti v zasebno mrežo. Ne-razrešljiva imena (npr. testni .example TLD)
    // niso SSRF-vektor, zato `resolveAndVerifyEndpoint` zanje vrne ok:true in
    // pošiljanje nadaljuje — transport bo vrnil mrežno napako oz. mock odgovor.
    const dnsCheck = await resolveAndVerifyEndpoint(v.publicHost)
    if (!dnsCheck.ok) {
      return {
        accepted: false,
        providerMessageId: null,
        state: "FAILED",
        technicalOnly: false,
        errors: [`SSRF: ${dnsCheck.error}`],
      }
    }

    const errors: string[] = []
    let lastStatus = 0
    let lastText = ""

    // P1 DNS-rebinding: če je DNS preveril resoliran javni IP, povežemo TCP
    // NEPOSREDNO na ta IP (nikoli ponovna razrešitev hostname-ja). Hostname
    // ohranimo za TLS SNI in HTTP `Host`. Če `dnsCheck.ip` ni na voljo
    // (ne-razrešljivo ime kot `.example` → testni/mock transport), uporabimo
    // injektabilni global fetch, ki ga enote Mockajo.
    const sendDirect = async () => {
      const headers = {
        "Content-Type": "application/xml; charset=utf-8",
        Accept: "application/json, application/xml",
        "Idempotency-Key": payload.einvoiceId,
        "X-EInvoice-Sha256": payload.xmlSha256,
        "X-EInvoice-Org": orgId,
        "X-EInvoice-Api-Key": cfg.credentials?.apiKey ?? "",
      }
      if (dnsCheck.ip) {
        // Produkcijska pot: pingnjen IP prek node:https z lookup override →
        // SNI/Host ostaneta originalni hostname. `redirect: manual` ustreza
        // temu, da node:https ne sledi 3xx samodejno.
        const opts = buildHttpsRequestOptions(cfg, headers, dnsCheck.ip)
        const r = await pickDirectTransport(this)(opts, payload.xml)
        return {
          status: r.status,
          text: r.body.slice(0, 500),
          header: (name: string) => {
            const v = r.headers?.[name.toLowerCase()]
            if (Array.isArray(v)) return v.join(", ")
            return v ?? null
          },
        }
      }
      // Testna/mock pot: `.example` in injektabilni global fetch brez mreže.
      if (!cfg.providerEndpoint) {
        throw new Error("CHANNEL_NOT_READY: providerEndpoint ni nastavljen.")
      }
      const res = await getGlobalFetch()(cfg.providerEndpoint, {
        method: "POST",
        redirect: "manual", // #1318: ne sledi 3xx na morebiti notranji naslov
        headers,
        body: payload.xml,
      })
      return {
        status: res.status,
        text: await safeText(res),
        header: (name: string) => res.headers.get(name) ?? null,
      }
    }

    // Retry do MAX_RETRIES za začasne (5xx) napake; 4xx ne retryarno.
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await sendDirect()
        lastStatus = res.status
        lastText = res.text.slice(0, 500)

        if (res.status >= 200 && res.status < 300) {
          const providerId = res.header("x-provider-message-id")
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
    // Faza 3.2 — test/integracijski override stanja dostave za deterministično
    // preverjanje dostavne zanke brez prave ponudnikove povezave.
    if (directStatusOverride) {
      return (await directStatusOverride(providerMessageId)) as DeliveryStatus
    }
    return {
      state: "SUBMITTED",
      providerStatus: providerMessageId ? "pending" : "unmapped",
      timestamp: new Date().toISOString(),
      message: null,
    }
  }

  verifyWebhook(
    orgId: string,
    cfg: ChannelCfg,
    signatureHeader: string | null,
    timestampHeader: string | null,
    rawBody: string | Buffer
  ): boolean {
    // A3 — Interni Direct kanal uporablja HMAC-SHA256 podpis s skrivnostjo na
    // ravni kanala (ChannelCfg.credentials.webhookSecret), nad SUROVIM telesom,
    // s časovno omejitvijo in zaščito pred ponovitvijo. Brez skrivnosti ali ob
    // neuspešni verifikaciji → zavrnjeno (fail-closed).
    if (cfg.organizationId !== orgId) return false

    const secret = cfg.credentials?.webhookSecret ?? null
    if (!secret) {
      // Kanal nima konfiguriranega webhook ključa → zavrni; nikoli ne vračaj `true`
      // le zato, ker je header prisoten.
      return false
    }
    return verifyWebhookHmac(secret, signatureHeader, timestampHeader, rawBody)
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
    _timestampHeader: string | null,
    _rawBody: string | Buffer
  ): boolean {
    return false
  }
}

/**
 * Transport za mTLS HTTPS dostavo. Injektabilen za teste; privzeto `https.request`.
 * Vrne obljubo { status, headers, body } — normalizira ClientRequest/Response.
 */
export type HttpsTransport = (
  opts: https.RequestOptions,
  xml: string
) => Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }>

// Testni injekcijski transport za DirectHttpProvider. Uporablja ga submitEinvoice
// (ki provider zgradi prek buildProvider brez instance-reference), kadar npr.
// integracijski test pošilja na `.example` naslov skozi mock DNS → pinned IP.
let directTransportOverride: HttpsTransport | null = null
export function __setDirectTransportForTests(t: HttpsTransport | null): void {
  directTransportOverride = t
}

// Faza 3.2 — testni override stanja dostave za Direct kanal (deterministična
// dostavna zanka; brez prave ponudnikove povezave).
export type DirectStatusResolver = (
  providerMessageId: string
) => Promise<{
  state: "SUBMITTED" | "DELIVERED" | "REJECTED" | "FAILED"
  providerStatus: string
  timestamp: string
  message: string | null
}>
let directStatusOverride: DirectStatusResolver | null = null
export function __setDirectStatusForTests(r: DirectStatusResolver | null): void {
  directStatusOverride = r
}
function pickDirectTransport(instance: { _directTransport: HttpsTransport }): HttpsTransport {
  // Kadar je v testu podan override, ima prednost (ITest) — sicer per-instance
  // (enotni testi), nato privzeti nodeHttpsTransport.
  return directTransportOverride ?? instance._directTransport
}

/** Implementation na osnovi `node:https` (podpira klientov X.509 certifikat). */
export function nodeHttpsTransport(opts: https.RequestOptions, xml: string): Promise<{
  status: number
  headers: Record<string, string | string[] | undefined>
  body: string
}> {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (c) => chunks.push(Buffer.from(c)))
      res.on("end", () => {
        resolve({ status: res.statusCode ?? 0, headers: res.headers as Record<string, string | string[] | undefined>, body: Buffer.concat(chunks).toString("utf8") })
      })
    })
    req.on("error", reject)
    req.setTimeout(opts.timeout ?? 20_000, () => req.destroy(new Error("HTTPS_TIMEOUT")))
    req.write(xml)
    req.end()
  })
}

/**
 * Sestavi `https.RequestOptions` iz dešifriranih poverilnic kanala. Preverljivo
 * brez omrežja. Cert/ključ/CA prihajajo iz `ChannelCfg.credentials` (občutljivo,
 * nastavi ključ v action) — tukaj se nikoli ne shranjuje čistih v DB.
 */
export function buildHttpsRequestOptions(
  cfg: ChannelCfg,
  headers: Record<string, string>,
  pinnedIp?: string | null
): https.RequestOptions {
  if (!cfg.providerEndpoint) throw new Error("CHANNEL_NOT_READY: providerEndpoint ni nastavljen.")
  const url = new URL(cfg.providerEndpoint)
  const cred = cfg.credentials ?? {}
  const hostname = url.hostname
  const opts: https.RequestOptions = {
    hostname,
    port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : undefined,
    path: `${url.pathname}${url.search}`,
    method: "POST",
    // #1318 (P1 DNS-rebinding): ko imamo DNS preverjen IP (resolveAndVerifyEndpoint),
    // povežemo TCP NEPOSREDNO na ta IP — nikoli ne razrešimo hostname-ja še
    // enkrat (kar bi omogočilo rebinding). Hostname OHRANIMO za TLS SNI
    // (`servername`) in HTTP `Host` glavo, da TLS veriga in virtualno hostanje
    // delujeta. Kadar `pinnedIp` ni na voljo (ne-reseljivo ime, mock test), se
    // uporabi običajno razreševanje — v produkciji je to le izjema (glej
    // resolveAndVerifyEndpoint).
    ...(pinnedIp
      ? {
          lookup: (
            _host: string,
            _lookupOpts: unknown,
            cb: (err: NodeJS.ErrnoException | null, address: string, family: number) => void
          ) => cb(null, pinnedIp, isIP(pinnedIp) === 6 ? 6 : 4),
          // TLS SNI = originalni hostname (ne preverjeni IP), za pravilno
          // predstavitev certifikata končne točke.
          servername: hostname,
        }
      : {}),
    // Host glava: originalni hostname, da virtualni gostitelj dobi pravilno
    // zahtevo tudi, ko povezujemo na preverjeni IP.
    headers: { ...headers, Host: hostname },
    // mTLS X.509 klient certifikat + private key (UJP SIGOV-CA / PEPPOL AP cert).
    // mTLS X.509 klient certifikat + private key (UJP SIGOV-CA / PEPPOL AP cert).
    ...(cred.cert ? { cert: cred.cert } : {}),
    ...(cred.key ? { key: cred.key } : {}),
    ...(cred.ca ? { ca: cred.ca } : {}),
    ...(cred.passphrase ? { passphrase: cred.passphrase } : {}),
    // #1318 TLS-zaščita: preverjanje certifikata je VEDNO vklopljeno
    // (rejectUnauthorized: true). Nekdanji `insecureSkipVerify` preklop je bil
    // umaknjen, da produkcija nikoli ne more izklopiti preverjanja in da testna
    // izjema ne more nenamerno priti v produkcijo. Testi uporabijo pravo testno
    // CA, ne izklopa preverjanja.
    rejectUnauthorized: true,
    timeout: 20_000,
  } as https.RequestOptions & { timeout?: number }
  return opts
}

/**
 * Ovije izvorni UBL/e-SLOG XML v strukturo e-SLOG 2.0 `JointDokument` ovojnice
 * (za kanal `ujp`). PONOVNI PREGLED: dejanski odhod na UJP pogosto zahteva še
 * XMLDSig podpis te ovojnice — struktura je tu, podpis doda udeleženec prek
 * `config`/S-MIME pred oddajo v produkciji.
 */
export function eSlogJointWrapper(ublXml: string): string {
  const clean = ublXml.trim()
  return `<vd:JointDokument xmlns:vd="http://www.skrlj.si/eSlog/schema/JointDokument-2.0">
  <vd:Vsebina>
    ${clean}
  </vd:Vsebina>
</vd:JointDokument>`
}

/**
 * Certifikatni (mutual-TLS) ponudnik za UJP in PEPPOL AP.
 *
 * `channel` določi način:
 *   • "ujp"   → arhiviran dokument (UBL/e-SLOG) se pošlje z X.509 klient cert
 *               na UJP DK končno točko; če `config.mode === "eslog-joint"` se
 *               ovojnica JointDokument dodana pred pošiljanjem.
 *   • "peppol" → arhiviran UBL 2.1 se pošlje na PEPPOL AP inbound z X.509 klient
 *               cert (AS4 TLS pasica; protokolna plast na AP).
 *
 * Idempotenca prek `Idempotency-Key`, integriteta prek `X-EInvoice-Sha256`,
 * retry (eksponentni backoff) za začasne 5xx/mrežne napake, 4xx brez retryja.
 */
export class CertHttpProvider implements EInvoiceProvider {
  readonly kind: "UJP" | "PEPPOL_AP"
  readonly label: string
  readonly testMode: boolean
  private readonly transport: HttpsTransport

  constructor(kind: "UJP" | "PEPPOL_AP", opts?: { testMode?: boolean; transport?: HttpsTransport }) {
    this.kind = kind
    this.testMode = opts?.testMode ?? false
    this.label = kind === "UJP" ? "UJP (e-SLOG / DO)" : "PEPPOL AP (AS4/X.509)"
    this.transport = opts?.transport ?? nodeHttpsTransport
  }

  private headersFor(cfg: ChannelCfg, p: SubmitPayload, contentType = "application/xml; charset=utf-8"): Record<string, string> {
    return {
      "Content-Type": contentType,
      Accept: "application/json, application/xml",
      "Idempotency-Key": p.einvoiceId,
      "X-EInvoice-Sha256": p.xmlSha256,
      "X-EInvoice-Org": cfg.organizationId,
      "X-EInvoice-Channel": this.kind,
      "X-EInvoice-Recipient": p.recipientId ?? "",
    }
  }

  async submit(orgId: string, cfg: ChannelCfg, payload: SubmitPayload): Promise<SubmissionResult> {
    if (!cfg.providerEndpoint || !/^https?:\/\//i.test(cfg.providerEndpoint)) {
      return {
        accepted: false,
        providerMessageId: null,
        state: "FAILED",
        technicalOnly: false,
        errors: ["CHANNEL_NOT_READY: providerEndpoint ni nastavljen za UJP/PEPPOL kanal."],
      }
    }
    // UJP: po potrebi zavij v e-SLOG JointDokument ovojnico in (če je ključ +
    // cert na voljo) jo XMLDSig-podpiši. Podpis izpustimo samo, če je izrecno
    // `config.sign === false` ali če kanal nima ključa/certifikata.
    let body = payload.xml
    let contentType = "application/xml; charset=utf-8"
    // PEPPOL_AP: dejanski Prenos je AS4/ebMS3 — sestavi multipart/related paket
    // (SOAP 1.2 + SBDH + dokument), ne pa golega XML. Zahteva prejemnikov
    // iso6523-actorid-upis ter localno UPI (sendingPartyId).
    if (this.kind === "PEPPOL_AP") {
      const as4 = buildAs4Multipart({
        sendingPartyId:
          (cfg.config?.sendingPartyId as string) ?? cfg.credentials?.upis ?? cfg.organizationId,
        receivingPartyId: payload.recipientId ?? "",
        service: "urn:fdc:peppol.eu:2017:poacc:billing:3.0::Invoice",
        action: "urn:fdc:peppol.eu:2017:poacc:billing:3.0::3.0",
        role: "urn:fdc:peppol.eu:2017:roles:ap_provider",
        documentXml: payload.xml,
        certPem: cfg.credentials?.cert,
        conversationId: payload.einvoiceId,
      })
      body = as4.multipartBody
      contentType = as4.contentType
    }
    if (this.kind === "UJP" && cfg.config?.mode === "eslog-joint") {
      const wrapped = eSlogJointWrapper(payload.xml)
      const key = cfg.credentials?.key
      const cert = cfg.credentials?.cert
      const wantSign = cfg.config?.sign !== false
      if (wantSign && key && cert) {
        try {
          body = xmlDsigSign({
            xml: wrapped,
            certPem: cert,
            keyPem: key,
            passphrase: cfg.credentials?.passphrase,
            documentId: payload.einvoiceId,
          }).signedXml
        } catch {
          // Podpis ni uspel (npr. neveljaven ključ) — pusti nepodpisano;
          // UJP bo oddajo zavrnil, kar je boljše kot uhajanje nepodpisanega
          // dokumenta kot "podpisanega".
          body = wrapped
        }
      } else {
        body = wrapped
      }
    }

    const errors: string[] = []
    let opts: https.RequestOptions
    try {
      // #1318 SSRF-zaščita pred obema pošiljalskima potema: endpoint mora biti
      // veljaven JAVEN URL, DNS pa ne smem razrešiti v zasebno mrežo.
      const v = assertPublicHttpsUrl(cfg.providerEndpoint)
      if (!v.ok) return { accepted: false, providerMessageId: null, state: "FAILED", technicalOnly: false, errors: [`SSRF: ${v.error}`] }
      const dns = await resolveAndVerifyEndpoint(v.publicHost)
      if (!dns.ok) return { accepted: false, providerMessageId: null, state: "FAILED", technicalOnly: false, errors: [`SSRF: ${dns.error}`] }
      opts = buildHttpsRequestOptions(cfg, this.headersFor(cfg, payload, contentType), dns.ip)
    } catch (e) {
      return {
        accepted: false,
        providerMessageId: null,
        state: "FAILED",
        technicalOnly: false,
        errors: [e instanceof Error ? e.message : "CHANNEL_NOT_READY"],
      }
    }
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await this.transport(opts, body)
        if (res.status >= 200 && res.status < 300) {
          const pid =
            (typeof res.headers?.["x-provider-message-id"] === "string"
              ? res.headers["x-provider-message-id"]
              : undefined) ?? null
          return {
            accepted: true,
            providerMessageId: pid,
            state: "SUBMITTED",
            technicalOnly: true, // HTTP 2xx = tehnično sprejeto; vsebinsko potrditev daje AP/webhook/polling.
            errors: [],
          }
        }
        if (res.status >= 400 && res.status < 500) {
          errors.push(`HTTP ${res.status}: ${(res.body || "client error").slice(0, 500)}`)
          break
        }
        errors.push(`HTTP ${res.status}: ${(res.body || "server error").slice(0, 500)}`)
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
      errors: errors.length ? errors : ["CHANNEL_NOT_READY: UJP/PEPPOL napaka"],
    }
  }

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
    _timestampHeader: string | null,
    _rawBody: string | Buffer
  ): boolean {
    // A4 — Certifikatni kanal (UJP/PEPPOL) trenutno NIMA implementiranega
    // dokumentiranega podpisnega protokola za povratne webhooke. Ker lahko
    // preverjamo samo verodostojen podpis, vsak webhook zavrnemo (fail-closed).
    // Ko bo uradni Podpis/ACE-dokazilo implementiran, se to nadomesti z realno
    // verifikacijo; status za certifikatni kanal ostaja izključno prek varnega
    // statusnega polla (SUBMITTED, dokler ni trdnega dokaza). Nikoli `true` zgolj
    // zaradi prisotnosti headerja.
    return false
  }
}

/**
 * Registry preslika kanal-vrsto v ponudnika. "direct" → generic HTTP; "ujp" in
 * "peppol" → certifikatni mutual-TLS dostavi (UJP / PEPPOL AP). Neznan kanal
 * se obnaša kot UnconfiguredProvider, da UI ne laže o oddaji.
 */
export function buildProvider(channel: string): EInvoiceProvider {
  switch (channel) {
    case "direct":
      return new DirectHttpProvider()
    case "ujp":
      return new CertHttpProvider("UJP")
    case "peppol":
      return new CertHttpProvider("PEPPOL_AP")
    default:
      return new UnconfiguredProvider()
  }
}