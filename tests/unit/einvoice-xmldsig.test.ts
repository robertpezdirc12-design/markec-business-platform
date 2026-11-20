// ============================================================
// F5.5.4.6.4 — enotni testi XMLDSig (xmldsig.ts) + certifikatni podpis.
//
// Brez baze, čista TS + node:crypto. Dokazuje:
//   • canonicalizeXml — deterministična ekskluzivna C14N za naše oblike;
//   • xmlDsigSign / xmlDsigVerify — round-trip podpis + preverba z node:crypto;
//   • CertHttpProvider (UJP eslog-joint) s ključem+certom dank Exec podpisan
//     JointDokument; Drugi preverbi 4xx/network etc. bugi: ne zapletamo.
// ============================================================

import { describe, expect, it } from "vitest"
import {
  canonicalizeXml,
  xmlDsigSign,
  xmlDsigVerify,
  makeSelfSignedTestPair,
} from "@/lib/einvoice/xmldsig"
import { CertHttpProvider, eSlogJointWrapper } from "@/lib/einvoice/providers"
import type { ChannelCfg, SubmitPayload } from "@/lib/einvoice/channel"
import type { HttpsTransport } from "@/lib/einvoice/providers"

const ORG = "org-1"
const payload: SubmitPayload = {
  einvoiceId: "e-inv-9",
  organizationId: ORG,
  docCode: "RAC-9",
  format: "UBL21_PEPPOL_3",
  xml: "<Invoice/>",
  xmlSha256: "a".repeat(64),
  recipientId: "0088:SI12345678",
}

describe("F5.5.4.6.4 — canonicalizeXml (ekskluzivna C14N za naše oblike)", () => {
  it("deterministično razvrsti namespace in atribute ter izprazni inter-praznine", () => {
    const inXml = [
      '<vd:JointDokument xmlns:vd="http://x" attrZ="2"   attrA="  1  ">',
      "   ",
      "   <vd:Vsebina><Invoice/><CreditNote b=\"2\" a=\"1\"/></vd:Vsebina>",
      " ",
      "</vd:JointDokument>",
    ].join("\n")
    const out = canonicalizeXml(inXml)
    // namespace vd najprej, atribute (ne-ns) po abecedi (attrA < attrZ)
    expect(out).toContain('xmlns:vd="http://x"')
    expect(out.indexOf('attrA="1"')).toBeGreaterThan(out.indexOf('xmlns:vd'))
    expect(out.indexOf('attrZ="2"')).toBeGreaterThan(out.indexOf('attrA="1"'))
    // inter-praznine med elementi odstranjene → korena je en elementenska linija
    expect(/\n/.test(out)).toBe(false)
    // samozapršni otrok pravilno kanonikaliziran (po abecedi a < b)
    expect(out).toContain('<CreditNote a="1" b="2"/>')
  })

  it("ohrani tekstovno vsebino (npr. telo <Invoice>)", () => {
    const out = canonicalizeXml("<vd:Vsebina xmlns:vd=\"x\">Obračun št. <b>1</b></vd:Vsebina>")
    expect(out).toContain("Obračun št. ")
    expect(out).toContain("<b>1</b>")
  })
})

describe("F5.5.4.6.4 — xmlDsigSign / xmlDsigVerify (round-trip)", () => {
  it("podpiše e-SLOG JointDokument in ga uspešno preveri z javnim ključem", () => {
    const pair = makeSelfSignedTestPair()
    const doc = eSlogJointWrapper(payload.xml)
    const signed = xmlDsigSign({
      xml: doc,
      certPem: pair.certPem,
      keyPem: pair.keyPem,
    })
    expect(signed.signedXml).toContain("<ds:Signature")
    expect(signed.signedXml).toContain("<ds:X509Certificate>")
    expect(signed.signedXml).toContain(signed.digestValueBase64)
    expect(signed.signedXml).toContain(signed.signatureValueBase64)
    // Validnost
    expect(xmlDsigVerify(signed.signedXml, pair.publicKeyPem)).toBe(true)
  })

  it("spremenjen dokument → preverba pade (podpis je odvisen od vsebine)", () => {
    const pair = makeSelfSignedTestPair()
    const doc = eSlogJointWrapper(payload.xml)
    const signed = xmlDsigSign({ xml: doc, certPem: pair.certPem, keyPem: pair.keyPem })
    // Neizpodbita vsebina velja…
    expect(xmlDsigVerify(signed.signedXml, pair.publicKeyPem)).toBe(true)
    // …a sprememba vsebine pade digest-preverbo → celoten podpis neveljaven.
    const tampered = signed.signedXml.replace(payload.xml, "<Invoice><Change/></Invoice>")
    expect(xmlDsigVerify(tampered, pair.publicKeyPem)).toBe(false)
  })
})

describe("F5.5.4.6.4 — CertHttpProvider XMLDSig podpis (UJP eslog-joint s ključem+certom)", () => {
  it("z ključem in certom pošlje PODPISAN JointDokument", async () => {
    const pair = makeSelfSignedTestPair()
    const sent: string[] = []
    const transport: HttpsTransport = async (_opts, xml) => {
      sent.push(xml)
      return { status: 202, headers: {}, body: "" }
    }
    const ujp = new CertHttpProvider("UJP", { transport })
    const cfg: ChannelCfg = {
      id: "cfg-ujp",
      organizationId: ORG,
      channel: "ujp",
      providerEndpoint: "https://ujp-ppap.example/dostava",
      credentials: { cert: pair.certPem, key: pair.keyPem },
      config: { mode: "eslog-joint" },
    }
    const res = await ujp.submit(ORG, cfg, payload)
    expect(res.accepted).toBe(true)
    expect(sent[0]).toContain("<ds:Signature")
    expect(sent[0]).toContain("vd:JointDokument")
    expect(sent[0]).toContain("<Invoice/>")
  })

  it("brez ključa → pošlje nepodpisan JointDokument (struktura še vedno prisotna)", async () => {
    const sent: string[] = []
    const transport: HttpsTransport = async (_opts, xml) => {
      sent.push(xml)
      return { status: 202, headers: {}, body: "" }
    }
    const ujp = new CertHttpProvider("UJP", { transport })
    const cfg: ChannelCfg = {
      id: "cfg-ujp",
      organizationId: ORG,
      channel: "ujp",
      providerEndpoint: "https://ujp-ppap.example/dostava",
      credentials: { cert: "no-key", key: "" },
      config: { mode: "eslog-joint" },
    }
    const res = await ujp.submit(ORG, cfg, payload)
    expect(res.accepted).toBe(true)
    expect(sent[0]).toContain("vd:JointDokument")
    expect(sent[0]).not.toContain("<ds:Signature")
  })

  it("config.sign=false izpusti podpis tudi ob prisotnem ključu", async () => {
    const pair = makeSelfSignedTestPair()
    const sent: string[] = []
    const transport: HttpsTransport = async (_opts, xml) => {
      sent.push(xml)
      return { status: 202, headers: {}, body: "" }
    }
    const ujp = new CertHttpProvider("UJP", { transport })
    const cfg: ChannelCfg = {
      id: "cfg-ujp",
      organizationId: ORG,
      channel: "ujp",
      providerEndpoint: "https://ujp-ppap.example/dostava",
      credentials: { cert: pair.certPem, key: pair.keyPem },
      config: { mode: "eslog-joint", sign: false },
    }
    await ujp.submit(ORG, cfg, payload)
    expect(sent[0]).not.toContain("<ds:Signature")
  })
})