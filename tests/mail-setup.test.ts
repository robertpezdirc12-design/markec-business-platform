// ============================================================
// MAIL SETUP CHECK — testi čistih helperjev (brez mrežnih klicev).
// Pokrijejo realno stanje rcbeautysalon.org (SPF/DKIM na poddomeni,
// podvojen DMARC, manjkajoča Resend ključa) in ciljno stanje.
// ============================================================

import { describe, expect, it } from "vitest"
import {
  isUsableApiKey,
  parseSenderDomain,
  registrableDomain,
  classifyTxt,
  parseNslookupTxt,
  parseNslookupMx,
  evaluateMailSetup,
} from "../scripts/check-mail-setup.mjs"

const DNS = (over: Partial<{
  rootTxt: string[]
  sendTxt: string[]
  dkimTxt: string[]
  dmarcTxt: string[]
  sendMx: string[]
}> = {}) => ({
  rootTxt: [],
  sendTxt: ["v=spf1 include:amazonses.com ~all"],
  dkimTxt: ["p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCrfCQJp2OX"],
  dmarcTxt: ["v=DMARC1; p=quarantine; adkim=r; aspf=r;"],
  sendMx: ["feedback-smtp.us-east-1.amazonses.com"],
  ...over,
})

const setup = (
  over: Partial<{ keyPresent: boolean; fromDomain: string | null }> = {},
  dnsOver: Parameters<typeof DNS>[0] = {}
) => evaluateMailSetup({
  keyPresent: true,
  fromDomain: "send.rcbeautysalon.org",
  ...over,
  dns: DNS(dnsOver),
})

describe("isUsableApiKey", () => {
  it("zavrne manjkajoč, prazen in placeholder ključ", () => {
    expect(isUsableApiKey(undefined)).toBe(false)
    expect(isUsableApiKey("")).toBe(false)
    expect(isUsableApiKey("   ")).toBe(false)
    expect(isUsableApiKey("re_placeholder_not_configured")).toBe(false)
  })

  it("sprejme realen ključ", () => {
    expect(isUsableApiKey("re_live_abc123")).toBe(true)
    expect(isUsableApiKey("  re_live_abc123  ")).toBe(true)
  })
})

describe("parseSenderDomain / registrableDomain", () => {
  it("izvleče in normalizira domeno", () => {
    expect(parseSenderDomain("Noreply@Send.RCBeautySalon.org")).toBe("send.rcbeautysalon.org")
    expect(parseSenderDomain("noreply@rcbeautysalon.org.")).toBe("rcbeautysalon.org")
  })

  it("zavrne neveljavne naslove", () => {
    expect(parseSenderDomain("")).toBeNull()
    expect(parseSenderDomain("ni-naslov")).toBeNull()
    expect(parseSenderDomain("a@@b.si")).toBeNull()
    expect(parseSenderDomain("a@localhost")).toBeNull()
  })

  it("vrne registrable domeno", () => {
    expect(registrableDomain("send.rcbeautysalon.org")).toBe("rcbeautysalon.org")
    expect(registrableDomain("rcbeautysalon.org")).toBe("rcbeautysalon.org")
  })
})

describe("classifyTxt", () => {
  it("loči SPF, DMARC in DKIM", () => {
    const out = classifyTxt([
      "v=spf1 include:amazonses.com ~all",
      "v=DMARC1; p=quarantine;",
      "p=MIGfMA0GCSqGSIb3DQEBAQUA",
      "google-site-verification=abc",
      "",
    ])
    expect(out.spf).toHaveLength(1)
    expect(out.dmarc).toHaveLength(1)
    expect(out.dkim).toHaveLength(1)
  })

  it("kratki DMARC p= ne šteje kot DKIM ključ", () => {
    const out = classifyTxt([
      "v=DMARC1; p=none;",
      "v=DMARC1; p=reject;",
      "v=spf1 a ~all",
    ])
    expect(out.dkim).toEqual([])
    expect(out.dmarc).toHaveLength(2)
  })
})

describe("parseNslookupTxt (Windows/Unix rezervni kanal)", () => {
  it("razstavi dva nasprotujoča si DMARC zapisa v dva recorda", () => {
    const out = [
      "Server:  connectivity-check.warp-svc",
      "Address:  127.0.2.2",
      "",
      "_dmarc.rcbeautysalon.org\ttext =",
      "",
      '\t"v=DMARC1; p=none;"',
      "_dmarc.rcbeautysalon.org\ttext =",
      "",
      '\t"v=DMARC1; p=quarantine; adkim=r; aspf=r;"',
    ].join("\n")
    const records = parseNslookupTxt(out)
    expect(records).toHaveLength(2)
    expect(records[0]).toContain("p=none")
    expect(records[1]).toContain("p=quarantine")
  })

  it("združi več narekovajenih kosov enega zapisa", () => {
    const out = 'send.example.org\ttext =\n\t"v=spf1 include:amazonses.com "\n\t"~all"'
    expect(parseNslookupTxt(out)).toEqual(["v=spf1 include:amazonses.com ~all"])
  })

  it("prazen izhod vrne prazno polje", () => {
    expect(parseNslookupTxt("")).toEqual([])
  })
})

describe("parseNslookupMx", () => {
  it("prebere exchange host", () => {
    expect(parseNslookupMx("send.example.org\tMX preference = 10, mail exchanger = feedback-smtp.us-east-1.amazonses.com")).toEqual([
      "feedback-smtp.us-east-1.amazonses.com",
    ])
  })
})

describe("evaluateMailSetup", () => {
  it("REALNO stanje: SPF in DKIM sta OK, manjkajo ključi in enotni DMARC", () => {
    const r = evaluateMailSetup({
      keyPresent: false,
      fromDomain: null,
      dns: DNS({ dmarcTxt: ["v=DMARC1; p=none;", "v=DMARC1; p=quarantine;"] }),
    })
    expect(r.ok).toBe(false)
    expect(r.failures).toEqual(["RESEND_API_KEY", "RESEND_FROM_EMAIL", "DMARC"])
    expect(r.checks.find((c) => c.name === "SPF")?.ok).toBe(true)
    expect(r.checks.find((c) => c.name === "DKIM")?.ok).toBe(true)
  })

  it("CILJNO stanje: vse zeleno, brez opozoril", () => {
    const r = setup()
    expect(r.ok).toBe(true)
    expect(r.failures).toEqual([])
    expect(r.warnings).toEqual([])
  })

  it("SPF na korenu prav tako zadostuje", () => {
    const r = setup({}, { sendTxt: [], rootTxt: ["v=spf1 include:amazonses.com ~all"], sendMx: [] })
    expect(r.checks.find((c) => c.name === "SPF")?.ok).toBe(true)
    expect(r.warnings.join(" ")).toContain("MX")
  })

  it("podvojen DMARC vedno fail-a", () => {
    const r = setup({}, { dmarcTxt: ["v=DMARC1; p=none;", "v=DMARC1; p=quarantine;"] })
    expect(r.ok).toBe(false)
    expect(r.failures).toContain("DMARC")
    expect(r.checks.find((c) => c.name === "DMARC")?.detail).toContain("nasprotujoči")
  })

  it("manjkajoč DMARC in manjkajoč DKIM sta ločeni napaki", () => {
    const r = setup({}, { dmarcTxt: [], dkimTxt: [] })
    expect(r.failures).toEqual(["DKIM", "DMARC"])
  })

  it("več SPF zapisov je opozorilo, ne napaka", () => {
    const r = setup({}, { rootTxt: ["v=spf1 a ~all"] })
    expect(r.ok).toBe(true)
    expect(r.warnings.join(" ")).toContain("SPF")
  })

  it("placeholder ključ ne zadostuje", () => {
    const r = setup({ keyPresent: false })
    expect(r.failures).toContain("RESEND_API_KEY")
  })

  it("neizpisan ključ: detail vsebuje le status, ne vrednosti", () => {
    const r = setup()
    const detail = r.checks.find((c) => c.name === "RESEND_API_KEY")?.detail || ""
    expect(detail).not.toContain("re_")
    expect(detail).toContain("nastavljen")
  })
})
