// ============================================================
// F5.5.4.6.4 — enotni testi PEPPOL AS4 / ebMS3 gradnje (as4.ts).
//
// Preverja DETERMINISTIČNO plast (brez omrežja): SOAP 1.2 ovojnica z
// eb:UserMessage, SBDH priloga, PartyId shema iso6523-actorid-upis,
// Service/Action/Role, AgreementRef (TIA AP Provider), ConversationId/MessageId,
// BinarySecurityToken X509, in multipart/related telo (cid:payload povezava).
// ============================================================

import { describe, expect, it } from "vitest"
import {
  buildAs4Multipart,
  buildSbh,
  buildSoapEnvelope,
  AGREEMENT_REF,
  DEFAULT_MPC,
} from "@/lib/einvoice/as4"

const routing = {
  sendingPartyId: "9914:SI12345678",
  receivingPartyId: "0088:3831111111111",
  service: "urn:fdc:peppol.eu:2017:poacc:billing:3.0::Invoice",
  action: "urn:fdc:peppol.eu:2017:poacc:billing:3.0::3.0",
  role: "urn:fdc:peppol.eu:2017:roles:ap_provider",
}

const sampleDoc = "<Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\"><cbc:ID>1</cbc:ID></Invoice>"

describe("F5.5.4.6.4 — as4 multipart", () => {
  const res = buildAs4Multipart({ ...routing, documentXml: sampleDoc })

  it("Content-Type je multipart/related s SOAP ovojnico", () => {
    expect(res.contentType).toContain('multipart/related; type="application/soap+xml"')
    expect(res.contentType).toContain("boundary=")
  })

  it("SOAP ovojnica vsebuje eb:UserMessage in zahtevane sheme", () => {
    expect(res.soapEnvelope).toContain("http://www.w3.org/2003/05/soap-envelope")
    expect(res.soapEnvelope).toContain("http://docs.oasis-open.org/ebxml-msg/ebms/v3.0/ns/core/200704/")
    expect(res.soapEnvelope).toContain("<eb:UserMessage>")
  })

  it("PartyId uporablja shemo iso6523-actorid-upis za pošiljatelja in prejemnika", () => {
    expect(res.soapEnvelope).toContain("urn:fdc:peppol.eu:2017:identifiers:party-id-type:iso6523")
    expect(res.soapEnvelope).toContain(routing.sendingPartyId)
    expect(res.soapEnvelope).toContain(routing.receivingPartyId)
  })

  it("AgreementRef (TIA AP), Service, Action, ConversationId in MPC so prisotni", () => {
    expect(res.soapEnvelope).toContain(`<eb:AgreementRef>${AGREEMENT_REF}</eb:AgreementRef>`)
    expect(res.soapEnvelope).toContain(routing.service)
    expect(res.soapEnvelope).toContain(routing.action)
    expect(res.soapEnvelope).toContain("<eb:ConversationId>")
  })

  it("multipart vsebuje SBDH prilogo pred dokumentom", () => {
    expect(res.multipartBody).toContain("<StandardBusinessDocumentHeader>")
    expect(res.multipartBody).toContain("iso6523-actorid-upis")
    expect(res.sbhXml).toContain("<StandardBusinessDocumentHeader>")
    const sbhIdx = res.multipartBody.indexOf("<StandardBusinessDocumentHeader>")
    const docIdx = res.multipartBody.indexOf(sampleDoc.slice(0, 40))
    expect(sbhIdx).toBeGreaterThan(-1)
    expect(docIdx).toBeGreaterThan(sbhIdx) // SBDH pred dokumentom
  })

  it("payload je povezan prek cid:payload tako v Body kot v PayloadInfo", () => {
    expect(res.soapEnvelope).toContain("cid:payload")
    expect(res.multipartBody).toContain("Content-ID: <payload>")
  })

  it("brez cert se ne vstavi BinarySecurityToken; s certom se ustvari X509 token", () => {
    expect(buildAs4Multipart({ ...routing, documentXml: sampleDoc }).soapEnvelope).not.toContain("BinarySecurityToken")
    const piece = buildAs4Multipart({ ...routing, documentXml: sampleDoc, certPem: "-----BEGIN CERTIFICATE-----\nQ2VydA==\n-----END CERTIFICATE-----" })
    expect(piece.soapEnvelope).toContain("BinarySecurityToken")
    expect(piece.soapEnvelope).toContain("Q2VydA==")
  })
})

describe("F5.5.4.6.4 — buildSoapEnvelope / buildSbh samostojno", () => {
  it("defaultMerge-Id in AgreementRef konstante", () => {
    expect(DEFAULT_MPC).toBe("urn:fdc:peppol.eu:2017:mpc:default")
    expect(AGREEMENT_REF).toBe("urn:fdc:peppol.eu:2017:agreements:tia:ap_provider")
  })

  it("SBDH ima Sender/Receiver/Najave s Authority iso6523-actorid-upis", () => {
    const sbh = buildSbh(routing, "doc-1")
    expect(sbh).toContain("PEPPOL-BIS")
    expect(sbh).toContain('Authority="iso6523-actorid-upis"')
    expect(sbh).toContain("doc-1")
  })

  it("envelope z novim FormatScope pripravi Body reference na payload", () => {
    const soap = buildSoapEnvelope(routing)
    expect(soap).toContain('<eb:Payload href="cid:payload"')
  })
})