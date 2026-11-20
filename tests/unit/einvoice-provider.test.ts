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
import { DirectHttpProvider, UnconfiguredProvider, buildProvider } from "@/lib/einvoice/providers"
import { MAX_RETRIES } from "@/lib/einvoice/channel"
import type { ChannelCfg, SubmitPayload } from "@/lib/einvoice/channel"

const ORG = "org-1"
const cfg: ChannelCfg = {
  id: "cfg-1",
  organizationId: ORG,
  channel: "direct",
  providerEndpoint: "https://partner.local/invoice",
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

beforeEach(() => vi.restoreAllMocks())
afterEach(() => vi.unstubAllGlobals())

describe("F5.5.4.6.4 — DirectHttpProvider", () => {
  it("2xx → accepted, SUBMITTED, s providerMessageId iz glave", async () => {
    mockFetch(201, { "x-provider-message-id": "msg-42" })
    const p = new DirectHttpProvider()
    const r = await p.submit(ORG, cfg, payload)
    expect(r.accepted).toBe(true)
    expect(r.state).toBe("SUBMITTED")
    expect(r.providerMessageId).toBe("msg-42")
    expect(r.errors).toEqual([])
  })

  it("pošlje XML kot POST na providerEndpoint z idempotency in integritetnimi glavami", async () => {
    const fn = vi.fn<typeof fetch>(async () => new Response("ok", { status: 200 }))
    vi.stubGlobal("fetch", fn)
    const p = new DirectHttpProvider()
    await p.submit(ORG, cfg, payload)
    expect(fn).toHaveBeenCalledTimes(1)
    const [url, init] = fn.mock.calls[0]
    const reqInit = (init ?? {}) as RequestInit
    expect(url).toBe(cfg.providerEndpoint)
    expect(reqInit.method).toBe("POST")
    expect((reqInit.headers as Record<string, string>)["Idempotency-Key"]).toBe("e-inv-1")
    expect((reqInit.headers as Record<string, string>)["X-EInvoice-Sha256"]).toBe(payload.xmlSha256)
    expect(reqInit.body).toBe("<Invoice/>")
  })

  it("5xx → poskusi retry do MAX_RETRIES, nazadnje FAILED", async () => {
    const fn = vi.fn(async () => new Response("boom", { status: 503 }))
    vi.stubGlobal("fetch", fn)
    const p = new DirectHttpProvider()
    const r = await p.submit(ORG, cfg, payload)
    expect(r.accepted).toBe(false)
    expect(r.state).toBe("FAILED")
    // 3 poskusi: 1 + (MAX_RETRIES-1) retry
    expect(fn).toHaveBeenCalledTimes(MAX_RETRIES)
    expect(r.errors.length).toBeGreaterThan(0)
  })

  it("4xx → brez retryja, takoj FAILED", async () => {
    const fn = vi.fn(async () => new Response("bad request", { status: 400 }))
    vi.stubGlobal("fetch", fn)
    const p = new DirectHttpProvider()
    const r = await p.submit(ORG, cfg, payload)
    expect(r.state).toBe("FAILED")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("prevara mreže → FAILED (retry vključeno)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNRESET") }))
    const p = new DirectHttpProvider()
    const r = await p.submit(ORG, cfg, payload)
    expect(r.state).toBe("FAILED")
    expect(r.accepted).toBe(false)
  })

  it("brez providerEndpoint → FAILED, brez omrežnega klica", async () => {
    const fn = vi.fn()
    vi.stubGlobal("fetch", fn)
    const p = new DirectHttpProvider()
    const r = await p.submit(ORG, { ...cfg, providerEndpoint: null as unknown as string }, payload)
    expect(r.state).toBe("FAILED")
    expect(r.errors[0]).toContain("CHANNEL_NOT_READY")
    expect(fn).not.toHaveBeenCalled()
  })
})

describe("F5.5.4.6.4 — UnconfiguredProvider + buildProvider", () => {
  it("UnconfiguredProvider vedno FAILED s opisom (ne pošlje omrežja)", async () => {
    const p = new UnconfiguredProvider()
    const r = await p.submit(ORG, cfg, payload)
    expect(r.state).toBe("FAILED")
    expect(r.errors[0]).toContain("CHANNEL_UNCONFIGURED")
  })

  it("buildProvider('direct') → DirectHttpProvider; neznani kanal → UnconfiguredProvider", () => {
    expect(buildProvider("direct")).toBeInstanceOf(DirectHttpProvider)
    expect(buildProvider("ujp")).toBeInstanceOf(UnconfiguredProvider)
    expect(buildProvider("peppol")).toBeInstanceOf(UnconfiguredProvider)
    expect(buildProvider("karkoli")).toBeInstanceOf(UnconfiguredProvider)
  })
})