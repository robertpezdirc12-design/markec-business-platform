import { describe, expect, it } from "vitest"
import {
  buildEinvoiceArchive,
  verifyEinvoiceArchive,
  type EinvoiceArchivePayload,
} from "@/lib/einvoice/archive"

const base: Omit<EinvoiceArchivePayload, "xml"> = {
  docCode: "RAC-0001/2026",
  kind: "INVOICE",
  format: "UBL21_PEPPOL_3",
  standardVersion: "PEPPOL-BIS-3.0.21",
  validatorVersion: "UBL-2.1",
  xmlValidatedXsd: true,
  xmlValidatedBusiness: true,
  status: "VALIDATED",
  sha256: "abc123",
  size: 1024,
  issuedAt: "2026-01-15T10:00:00.000Z",
  generatedAt: "2026-01-15T10:01:00.000Z",
  orgName: "Lepotni Studio",
}

describe("einvoice archive (.earc)", () => {
  it("sestavi deterministično datoteko z embedded XML in manifestom", () => {
    const f = buildEinvoiceArchive({ ...base, xml: "<Invoice/>" })
    expect(f.filename).toBe("RAC-0001_2026.earc")
    expect(f.content).toContain("=== E-RACUN ARHIV (earc/1.0) ===")
    expect(f.content).toContain('"docCode": "RAC-0001/2026"')
    expect(f.content).toContain('"orgName": "Lepotni Studio"')
    expect(f.content).toContain("<Invoice/>")
    expect(f.content).toContain(`earc-sha256:${f.sha256}`)
  })

  it("vrne internal SHA-256 ki zaključi celo datoteko", () => {
    const f = buildEinvoiceArchive({ ...base, xml: "<Invoice/>" })
    expect(f.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it("verifikator potrdi nepoškodovano datoteko in prebere docCode", () => {
    const f = buildEinvoiceArchive({ ...base, xml: "<Invoice/>" })
    expect(verifyEinvoiceArchive(f.content)).toEqual({
      ok: true,
      sha256: f.sha256,
      docCode: "RAC-0001/2026",
    })
  })

  it("verifikator zavrne spremenjen dokument (integiteta)", () => {
    const f = buildEinvoiceArchive({ ...base, xml: "<Invoice/>" })
    const mutated = f.content.replace("<Invoice/>", "<Invoice>SPREJEMENJENO</Invoice>")
    const res = verifyEinvoiceArchive(mutated)
    expect(res.ok).toBe(false)
    expect(res.sha256).toBeTruthy()
  })

  it("verifikator vrne ok:false za datoteko brez kontrolne črte", () => {
    expect(verifyEinvoiceArchive("=== ni arhiv ===").ok).toBe(false)
  })
})