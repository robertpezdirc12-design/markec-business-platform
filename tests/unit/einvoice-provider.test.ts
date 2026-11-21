// ============================================================
// F5.5.4.6.4 — enotni testi POŠTNO/oddajni sloj (providers.ts).
//
// Dokazuje: DirectHttpProvider 2xx → SUBMITTED (tehnično sprejeto),
// 5xx → retry (do MAX_RETRIES) → FAILED, 4xx → brez retry → FAILED,
// brez providerEndpoint → FAILED, UnconfiguredProvider → FAILED ter
// buildProvider preslikave. Uporabimo vi.stubGlobal za deterministic fetch.
// Brez baze — čista TS.
// ============================================================

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import {
  DirectHttpProvider,
  UnconfiguredProvider,
  CertHttpProvider,
  buildProvider,
  buildHttpsRequestOptions,
  eSlogJointWrapper,
} from "@/lib/einvoice/providers"
import { __setDnsLookupForTests, assertPublicHttpsUrl } from "@/lib/einvoice/endpoint-validation"
import { MAX_RETRIES } from "@/lib/einvoice/channel"
import type { ChannelCfg, SubmitPayload } from "@/lib/einvoice/channel"
import type { HttpsTransport } from "@/lib/einvoice/providers"

/** Testni mock transport — viden tip za _directTransport (HttpsTransport). */
type TransportMock = HttpsTransport

const ORG = "org-1"
const cfg: ChannelCfg = {
  id: "cfg-1",
  organizationId: ORG,
  channel: "direct",
  providerEndpoint: "https://provider.example/invoice",
  credentials: { apiKey: "secret" },
  config: {},
}
const payload: SubmitPayload = {
  einvoiceId: "e-inv-1",
  organizationId: ORG,
  docCode: "RAC-1",
  format: "UBL21_PEPPOL_3",
  xml: "<Invoice/>",
  xmlSha256: "a".repeat(64),
  recipientId: "0088:SI12345678",
}

function mockFetch(status: number, headers?: Record<string, string>) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status, headers }) as Response))
}

// F5 / #1318: testne `.example` domene razrešimo prek MOCK DNS na javni IP
// (ne na pravi resolver — a DNBI fail-closed v produkciji), tako da gre
// pošiljanje skozi pinned transport, ne na pravo omrežje.
const PUBLIC_TEST_IP = "93.184.216.34"
function mockDns() {
  __setDnsLookupForTests(async (host) => [{ address: PUBLIC_TEST_IP, family: 4 }])
}

beforeEach(() => {
  vi.restoreAllMocks()
  mockDns()
})
afterEach(() => {
  vi.unstubAllGlobals()
  __setDnsLookupForTests(null)
})

describe("F5.5.4.6.4 — DirectHttpProvider", () => {
  // P1:#1318 — DNS pinning: povezava uporabi preverjeni IP (ne ponovno
  // razreši hostname). Testi pošiljajo skozi injektabilni `_directTransport`.
  function mockDirectTransport(status: number, headers?: Record<string, string>) {
    return vi.fn<TransportMock>(async () => ({
      status,
      body: "",
      headers: headers ?? {},
    }))
  }

  it("2xx → accepted, SUBMITTED, s providerMessageId iz glave", async () => {
    const tr = mockDirectTransport(201, { "x-provider-message-id": "msg-42" })
    const p = new DirectHttpProvider()
    p._directTransport = tr
    const r = await p.submit(ORG, cfg, payload)
    expect(r.accepted).toBe(true)
    expect(r.state).toBe("SUBMITTED")
    expect(r.providerMessageId).toBe("msg-42")
    expect(r.errors).toEqual([])
  })

  it("P1: pošlje NEPOSREDNO na preverjeni IP z lookup override; hostname za SNI & Host", async () => {
    const tr = mockDirectTransport(200)
    const p = new DirectHttpProvider()
    p._directTransport = tr
    const r = await p.submit(ORG, cfg, payload)
    expect(r.state).toBe("SUBMITTED")
    const [opts, body] = tr.mock.calls[0]
    // lookup override → preverjeni javni IP (iz mock DNS), nikoli ponovna razrešitev.
    expect(typeof opts.lookup).toBe("function")
    const cb = opts.lookup as (
      h: string,
      o: unknown,
      done: (e: null, a: string, f: number) => void
    ) => void
    let pinnedIp = ""
    cb("ignored.example", {}, (_, a) => (pinnedIp = a))
    expect(pinnedIp).toBe(PUBLIC_TEST_IP)
    expect(opts.servername).toBe("provider.example")
    const h = (opts.headers ?? {}) as Record<string, string>
    expect(h["Host"]).toBe("provider.example")
    expect(h["Idempotency-Key"]).toBe(payload.einvoiceId)
    expect(h["X-EInvoice-Sha256"]).toBe(payload.xmlSha256)
    expect(body).toBe(payload.xml)
    expect(opts.hostname).toBe("provider.example")
  })

  it("5xx → poskusi retry do MAX_RETRIES, nazadnje FAILED", async () => {
    const tr = vi.fn<TransportMock>(async () => ({ status: 503, body: "boom", headers: {} }))
    const p = new DirectHttpProvider()
    p._directTransport = tr
    const r = await p.submit(ORG, cfg, payload)
    expect(r.accepted).toBe(false)
    expect(r.state).toBe("FAILED")
    expect(tr).toHaveBeenCalledTimes(MAX_RETRIES)
    expect(r.errors.length).toBeGreaterThan(0)
  })

  it("4xx → brez retryja, takoj FAILED", async () => {
    const tr = vi.fn<TransportMock>(async () => ({ status: 400, body: "bad request", headers: {} }))
    const p = new DirectHttpProvider()
    p._directTransport = tr
    const r = await p.submit(ORG, cfg, payload)
    expect(r.state).toBe("FAILED")
    expect(tr).toHaveBeenCalledTimes(1)
  })

  it("prevara mreže → FAILED (retry vključeno)", async () => {
    const fn = vi.fn<TransportMock>(async () => { throw new Error("ECONNRESET") })
    const p = new DirectHttpProvider()
    p._directTransport = fn
    const r = await p.submit(ORG, cfg, payload)
    expect(r.state).toBe("FAILED")
    expect(r.accepted).toBe(false)
    expect(fn).toHaveBeenCalledTimes(MAX_RETRIES)
  })

  it("brez providerEndpoint → FAILED, brez omrežnega klica", async () => {
    const tr = mockDirectTransport(200)
    const p = new DirectHttpProvider()
    p._directTransport = tr
    const r = await p.submit(ORG, { ...cfg, providerEndpoint: null as unknown as string }, payload)
    expect(r.state).toBe("FAILED")
    expect(r.errors[0]).toContain("CHANNEL_NOT_READY")
    expect(tr).not.toHaveBeenCalled()
  })
})

describe("F5.5.4.6.4 — UnconfiguredProvider + buildProvider", () => {
  it("UnconfiguredProvider vedno FAILED s opisom (ne pošlje omrežja)", async () => {
    const p = new UnconfiguredProvider()
    const r = await p.submit(ORG, cfg, payload)
    expect(r.state).toBe("FAILED")
    expect(r.errors[0]).toContain("CHANNEL_UNCONFIGURED")
  })

  it("buildProvider('direct') → DirectHttpProvider; ujp/peppol → CertHttpProvider; neznani → Unconfigured", () => {
    expect(buildProvider("direct")).toBeInstanceOf(DirectHttpProvider)
    expect(buildProvider("ujp")).toBeInstanceOf(CertHttpProvider)
    expect(buildProvider("peppol")).toBeInstanceOf(CertHttpProvider)
    expect(buildProvider("karkoli")).toBeInstanceOf(UnconfiguredProvider)
  })
})

describe("F5.5.4.6.4 — CertHttpProvider (UJP/PEPPOL mTLS)", () => {
  const certCfg: ChannelCfg = {
    id: "cfg-ujp",
    organizationId: ORG,
    channel: "ujp",
    providerEndpoint: "https://ujp-ppap.example/dostava",
    credentials: { cert: "PEM-CERT", key: "PEM-KEY", ca: "PEM-CA", passphrase: "s3cret" },
    config: {},
  }

  it("buildHttpsRequestOptions prenese cert/key/ca/passphrase in rejectUnauthorized", () => {
    const opts = buildHttpsRequestOptions(certCfg, { "Content-Type": "application/xml" })
    expect(opts.method).toBe("POST")
    expect(opts.cert).toBe("PEM-CERT")
    expect(opts.key).toBe("PEM-KEY")
    expect(opts.ca).toBe("PEM-CA")
    expect(opts.passphrase).toBe("s3cret")
    expect(opts.rejectUnauthorized).toBe(true)
    expect(opts.hostname).toBe("ujp-ppap.example")
  })

  it("insecureSkipVerify je ignoriran — rejectUnauthorized ostane TRUE (preverjanje cert vedno vklopljeno)", () => {
    // Faza 1.3 (#1318): nekdanji `insecureSkipVerify` preklop je bil umaknjen.
    // Tudi če config vsebuje insecureSkipVerify, preverjanje certifikata ne sme
    // biti izklopljeno — produkcija nikoli ne sme imeti mTLS brez verifikacije.
    const opts = buildHttpsRequestOptions(
      { ...certCfg, config: { insecureSkipVerify: true } },
      {}
    )
    expect(opts.rejectUnauthorized).toBe(true)
  })

  it("eSlogJointWrapper ovije UBL XML v vd:JointDokument", () => {
    const wrapped = eSlogJointWrapper("<Invoice/>")
    expect(wrapped).toContain("vd:JointDokument")
    expect(wrapped).toContain("vd:Vsebina")
    expect(wrapped).toContain("<Invoice/>")
  })

  it("ujp + mode eslog-joint pošlje ovojnico", async () => {
    const sent: string[] = []
    const transport: HttpsTransport = async (_opts, xml) => {
      sent.push(xml)
      return { status: 202, headers: { "x-provider-message-id": "ujp-1" }, body: "accepted" }
    }
    const ujp = new CertHttpProvider("UJP", { transport })
    await ujp.submit(ORG, { ...certCfg, config: { mode: "eslog-joint" } }, payload)
    expect(sent[0]).toContain("vd:JointDokument")
    expect(sent[0]).toContain("<Invoice/>")
  })

  it("peppol pošlje AS4 multipart/related z dokumentom (ne golega XML)", async () => {
    const peppolSent: { opts: { headers: unknown }; body: string }[] = []
    const pepTransport: HttpsTransport = async (opts, xml) => {
      peppolSent.push({ opts: opts as { headers: unknown }, body: xml })
      return { status: 202, headers: {}, body: "" }
    }
    const pep = new CertHttpProvider("PEPPOL_AP", { transport: pepTransport })
    await pep.submit(ORG, { ...certCfg, channel: "peppol" }, payload)
    const { opts, body: raw } = peppolSent[0]
    // Content-Type zahtevka je multipart/related z boundary, ne application/xml.
    expect((opts.headers as { "Content-Type": string })["Content-Type"]).toMatch(/^multipart\/related/)
    // PEPPOL kanala NE sme več poslati golega XML — pošlje AS4 multipart/related.
    expect(raw).not.toBe("<Invoice/>")
    expect(raw).toContain("Content-Type: application/soap+xml")
    expect(raw).toContain("eb:UserMessage")
    expect(raw).toContain("Content-ID: <sbh>")
    expect(raw).toContain("Content-ID: <payload>")
    // Dokument je vključen kot zadnja MIME priloga (cid:payload).
    expect(raw).toContain("<Invoice/>")
  })

  it("2xx → accepted SUBMITTED (tehnično), providerMessageId iz glave", async () => {
    const transport: HttpsTransport = async () => ({
      status: 202,
      headers: { "x-provider-message-id": "ap-99" },
      body: "accepted",
    })
    const p = new CertHttpProvider("PEPPOL_AP", { transport })
    const r = await p.submit(ORG, certCfg, payload)
    expect(r.accepted).toBe(true)
    expect(r.state).toBe("SUBMITTED")
    expect(r.providerMessageId).toBe("ap-99")
  })

  it("4xx → FAILED brez retryja (en klic)", async () => {
    const fn = vi.fn<HttpsTransport>(async () => ({ status: 403, headers: {}, body: "denied" }))
    const p = new CertHttpProvider("UJP", { transport: fn })
    const r = await p.submit(ORG, certCfg, payload)
    expect(r.state).toBe("FAILED")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("5xx → retry do MAX_RETRIES, nazadnje FAILED", async () => {
    const fn = vi.fn<HttpsTransport>(async () => ({ status: 503, headers: {}, body: "busy" }))
    const p = new CertHttpProvider("UJP", { transport: fn })
    const r = await p.submit(ORG, certCfg, payload)
    expect(r.state).toBe("FAILED")
    expect(fn).toHaveBeenCalledTimes(MAX_RETRIES)
  })

  it("mrežna napaka → FAILED (retry vključeno)", async () => {
    const fn = vi.fn<HttpsTransport>(async () => {
      throw new Error("UNABLE_TO_VERIFY_LEAF_SIGNATURE")
    })
    const p = new CertHttpProvider("PEPPOL_AP", { transport: fn })
    const r = await p.submit(ORG, certCfg, payload)
    expect(r.state).toBe("FAILED")
    expect(fn).toHaveBeenCalledTimes(MAX_RETRIES)
  })

  it("brez providerEndpoint → FAILED, brez transportnega klica", async () => {
    const fn = vi.fn<HttpsTransport>()
    const p = new CertHttpProvider("UJP", { transport: fn })
    const r = await p.submit(ORG, { ...certCfg, providerEndpoint: null as unknown as string }, payload)
    expect(r.state).toBe("FAILED")
    expect(r.errors[0]).toContain("CHANNEL_NOT_READY")
    expect(fn).not.toHaveBeenCalled()
  })
})

describe("F5.5.4.6.4 / TOČKA 7 — Host glava + IPv6 normalizacija", () => {
  it("TOČKA 7b: Host glava vzame url.host (z vrati / IPv6 oklepaji), hostname za SNI", () => {
    // Ne-privzeta vrata → Host mora vsebovati vrata.
    const withPort = buildHttpsRequestOptions(
      { ...cfg, providerEndpoint: "https://provider.example:8443/invoice" },
      { "Content-Type": "application/xml" },
      "198.51.100.10"
    )
    expect((withPort.headers as Record<string, string> | undefined)?.Host).toBe("provider.example:8443")
    expect(withPort.hostname).toBe("provider.example")

    // IPv6 literal z oglatimi oklepaji → Host ohrani oklepaje in vrata.
    const ipv6 = buildHttpsRequestOptions(
      { ...cfg, providerEndpoint: "https://[2001:db8::1]:8443/invoice" },
      { "Content-Type": "application/xml" },
      "2001:db8::1"
    )
    expect((ipv6.headers as Record<string, string> | undefined)?.Host).toBe("[2001:db8::1]:8443")
    expect(ipv6.hostname).toBe("[2001:db8::1]")
  })

  it("TOČKA 7a: endpoint-validation sprejme javni IPv6 literal in zavrne loopback IPv6", () => {
    // Javen (globally-routable) IPv6 literal — ne sme biti označen kot blokiran.
    const ok = assertPublicHttpsUrl("https://[2606:4700:4700::1111]:8443/einvoice")
    expect(ok.ok).toBe(true)
    expect(ok.ok && ok.publicHost).toBe("2606:4700:4700::1111")
    // Loopback/unique-local IPv6 (::1, fe80::, fd00::) — SSRF zavrnitev.
    const loopback = assertPublicHttpsUrl("https://[::1]:8443/einvoice")
    expect(loopback.ok).toBe(false)
    const ua = assertPublicHttpsUrl("https://[fc00::1]/einvoice")
    expect(ua.ok).toBe(false)
    // IPv4 še vedno deluje (regresija).
    const v4 = assertPublicHttpsUrl("https://8.8.8.8:443/einvoice")
    expect(v4.ok).toBe(true)
  })
})