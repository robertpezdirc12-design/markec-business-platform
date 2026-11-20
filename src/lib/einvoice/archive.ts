// ============================================================
// F5.5.4.6.6 — E-RAČUN ARHIV (zakonska hramba, FURS e-arhiv / B2B).
//
// Deterministčna, brez zunanjih odvisnosti (ni ZIP lib) arhivska
// enoblokovna datoteka ".earc" za nespremenljivo hrambo e-računa.
// Struktura je čitljiva v urejevalniku, strojno verifiable in vsebuje
// original dokument + metapodatke (izdajatelj, verzije standarda,
// validacijski statusi) + kontrolno vsoto SHA-256 cele datoteke.
//
// Zakonsko ozadje (raziskava): od 1.1.2028 postane B2B e-račun obvezen;
// e-arhiviranje že 2027/2028. Praksa FURS eArhiv ni formalizirana kot ZIP,
// ampak zahteva zanesljiv zapis z integriteto — ta paket to pokrije.
// ============================================================

import { createHash } from "node:crypto"

export interface EinvoiceArchivePayload {
  docCode: string
  kind: string // "INVOICE" | "ADVANCE" | "CREDIT"
  format: string // "ESLOG_2" | "UBL21_PEPPOL_3"
  standardVersion: string
  validatorVersion: string
  xmlValidatedXsd: boolean
  xmlValidatedBusiness: boolean
  status: string
  sha256: string
  size: number
  issuedAt: string | null
  generatedAt: string
  orgName: string
  xml: string
}

export interface EinvoiceArchiveFile {
  content: string
  sha256: string
  filename: string
}

function manifestLine(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex")
}

/**
 * Zgradi deterministično arhivsko datoteko ".earc".
 * Vrnjen SHA-256 pokriva cele telo datoteke (brez končne kontrolne črte),
 * zato ga prejemnik zlahka verificira z `verifyEinvoiceArchive`.
 */
export function buildEinvoiceArchive(p: EinvoiceArchivePayload): EinvoiceArchiveFile {
  const body =
    `=== E-RACUN ARHIV (earc/1.0) ===\n` +
    `--- manifest ---\n` +
    `${JSON.stringify(
      {
        docCode: p.docCode,
        kind: p.kind,
        format: p.format,
        standardVersion: p.standardVersion,
        validatorVersion: p.validatorVersion,
        xmlValidatedXsd: p.xmlValidatedXsd,
        xmlValidatedBusiness: p.xmlValidatedBusiness,
        status: p.status,
        sha256: p.sha256,
        size: p.size,
        issuedAt: p.issuedAt,
        generatedAt: p.generatedAt,
        orgName: p.orgName,
      },
      null,
      2
    )}\n` +
    `--- dokument ---\n` +
    `${p.xml}\n` +
    `--- konec ---\n`

  const bodyBuf = Buffer.from(body, "utf8")
  const sha256 = manifestLine(bodyBuf)
  const content = body + `earc-sha256:${sha256}\n`

  const safeBase = p.docCode.replace(/[^A-Za-z0-9._-]/g, "_")
  return {
    content,
    sha256,
    filename: `${safeBase}.earc`,
  }
}

/**
 * Verificira arhivsko datoteko ".earc": prebere kontrolno črto in jo
 * primerja s SHA-256 telesa. Vrne `ok` + manifest (če je razčlenljiv).
 */
export function verifyEinvoiceArchive(
  content: string
): { ok: boolean; sha256: string | null; docCode: string | null } {
  const marker = "\nearc-sha256:"
  const idx = content.lastIndexOf(marker)
  if (idx < 0) return { ok: false, sha256: null, docCode: null }
  const declared = content.slice(idx + marker.length).trim()
  const body = content.slice(0, idx + 1)
  const actual = createHash("sha256").update(Buffer.from(body, "utf8")).digest("hex")
  let docCode: string | null = null
  try {
    const m = body.match(/"docCode"\s*:\s*"([^"]+)"/)
    docCode = m ? m[1] : null
  } catch {
    docCode = null
  }
  return { ok: actual === declared, sha256: actual, docCode }
}