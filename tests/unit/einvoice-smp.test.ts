import { describe, expect, it } from "vitest"
import {
  TRANSPORT_PROFILE_AS4,
  extractCertificate,
  extractEndpoint,
  participantScheme,
  resolveSmp,
  resolveSmpMock,
  smlDnsName,
} from "@/lib/einvoice/smp"

describe("peppol SMP/SML razreševanje", () => {
  it("zgradi PEPPOL participant sifro iz icd+id", () => {
    expect(participantScheme("SI12345678", "SI")).toBe("b-SI12345678:SI")
    expect(participantScheme("991234567890", "0088")).toBe("b-991234567890:0088")
  })

  it("izračuna SML DNS ime deterministično (SHA1)", () => {
    const dns = smlDnsName("b-SI12345678:SI", "isop.test.edelivery.tech")
    expect(dns).toMatch(/^e[0-9a-f]{40}\.iso6523-actorid-upis\./i)
    expect(dns.endsWith(".iso6523-actorid-upis.isop.test.edelivery.tech")).toBe(true)
  })

  it("iz SMP XML izlušči endpoint in cert", () => {
    const xml = `<ServiceMetadata>
      <EndpointURL>https://ap.example.net/pms/as4</EndpointURL>
      <X509Certificate>QUJDREVGRw==</X509Certificate>
    </ServiceMetadata>`
    expect(extractEndpoint(xml)).toBe("https://ap.example.net/pms/as4")
    expect(extractCertificate(xml)).toBe("QUJDREVGRw==")
  })

  it("extractEndpoint vrne null brez EndpointURL", () => {
    expect(extractEndpoint("<X/>")).toBeNull()
  })

  it("mock resolver vrne end-to-end strukturo", async () => {
    const r = await resolveSmpMock({ id: "SI12345678", icd: "SI" })
    expect("participantId" in r && r.participantId).toBe("b-SI12345678:SI")
    expect("transportProfile" in r && r.transportProfile).toBe(TRANSPORT_PROFILE_AS4)
    expect("endpointUrl" in r && r.endpointUrl).toContain("mock-ap")
  })

  it("resolveSmp z mock fetch vrne uspeh ali strukturiran error", async () => {
    const okFetch = (async () =>
      new Response(
        `<ServiceMetadata><EndpointURL>https://x/pms</EndpointURL><X509Certificate>Q0VSVA==</X509Certificate></ServiceMetadata>`,
        { status: 200 }
      )) as unknown as typeof fetch
    const ok = await resolveSmp({ id: "SI12345678", icd: "SI" }, okFetch)
    expect("endpointUrl" in ok && ok.endpointUrl).toBe("https://x/pms")

    const notFound = (async () => new Response("", { status: 404 })) as unknown as typeof fetch
    const nf = await resolveSmp({ id: "SI1", icd: "SI" }, notFound)
    expect("kind" in nf && nf.kind).toBe("NOT_FOUND")

    const badFetch = (async () => new Response("<x/>", { status: 200 })) as unknown as typeof fetch
    const noMeta = await resolveSmp({ id: "SI1", icd: "SI" }, badFetch)
    expect("kind" in noMeta && noMeta.kind).toBe("NOT_FOUND")
  })
})