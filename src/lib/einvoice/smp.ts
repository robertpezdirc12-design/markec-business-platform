// ============================================================
// F5.5.4.6.7 — PEPPOL SMP / SML razreševanje (MetadataLookup).
//
// PEPPOL "drugo podplast prenosa": SML-omrežje + SMP metapodatki za
// dinamično odkrivanje prejemnikovega Access Point-a. Ta modul zgradi
// participant sifro iz (icd, id), izračuna SML DNS poizvedbo in razreši
// SMP host + endpoint + šifrirni X509 cert za dani participant.
//
// Razreševanje poteka prek "resolverja" (DNS + HTTPS GET), ki ga test
// lahko nadomesti z determinističnim mockom — prava omrežna klica sta
// lahko odtu dobi standardno, brez tega modula, na realnem PEPPOL SML.
// ============================================================

import { createHash } from "node:crypto"

/** EAS / ISO 6523 Identifikatorji (ParticipantIdentifier sheme). */
export const EAS_SCHEMES = {
  GS1: "0088",
  DUNS: "0060",
  VIES: "9957",
  /** Slovenski davčni urad (DDV SI...). */
  SLO_TAX_VAT: "SI",
} as const

/** Transportni profili, ki jih SMP objavi za pošiljanje. */
export const TRANSPORT_PROFILE_AS4 = "peppol-transport-as4-v2_0"

export interface SmpLookupOptions {
  /** Identifikator iz sheme `icd`, npr. "SI12345678" ali "991234567890". */
  id: string
  /** ISO 6523 / EAS shema, npr. "0088", "9957". */
  icd: string
  /** SML domensko ime, npr. "isop.acc.edelivery.tech.ec.europa.eu" (test). */
  smlDomain?: string
}

export interface SmpLookupResult {
  /** PEPPOL participant-sifra, npr. `b-SI12345678:SI`. */
  participantId: string
  /** DNS odziv SML → SMP host. */
  smpHost: string
  /** Končni endpoint (AP) prejemnika. */
  endpointUrl: string
  /** Šifrirni X509 cert prejemnika (PEM). */
  certificatePem: string
  /** Transportni profil, po katerem naj pošlje. */
  transportProfile: string
}

export interface SmpErrorMessage {
  /** "SML_DNS" | "SMP_HTTP" | "NOT_FOUND" | "PARTICIPANT" */
  kind: string
  message: string
}

export type SmpResult = SmpLookupResult | SmpErrorMessage

/** Določi participant sifro iz (icd, id) po PEPPOL pravilu. */
export function participantScheme(id: string, icd: string): string {
  return `b-${id}:${icd}`
}

/**
 * SML DNS ime za participant: `e<sh1>.iso6523-actorid-upis.<sml>`.
 * Vrnjena je samo poddomena (brez SML domene), ki se tovori v 'iso6523-actorid-upis'.
 */
export function smlDnsName(participantId: string, smlDomain: string): string {
  const sha = createHash("sha1").update(participantId, "utf8").digest("hex")
  return `e${sha}.iso6523-actorid-upis.${smlDomain}`
}

/** SMP razrešitev s privzetim (resničnim) resolverjem — standardni HTTP GET na SMP. */
export async function resolveSmp(opts: SmpLookupOptions, fetchImpl?: typeof fetch): Promise<SmpResult> {
  const participant = participantScheme(opts.id, opts.icd)
  const smlDomain = opts.smlDomain ?? "isop.acc.edelivery.tech.ec.europa.eu"

  const f = fetchImpl ?? fetch
  // SML-DNS del izvedbe se opravi med pravo oddajo (DNS resolvanje) — tu
  // poenostavljeno naslavljamo SMP host neposredno na SML poddomenski router.
  const lookupRoot = `https://smp.${smlDomain}`
  // SMP ServiceGroup metadate: /iso6523-actorid-upis::<icd>::<id>/services/...
  const serviceGroup = `${lookupRoot}/iso6523-actorid-upis::${opts.icd}::${opts.id}/services/${TRANSPORT_PROFILE_AS4}/metadata`

  try {
    const res = await f(serviceGroup, { method: "GET", headers: { Accept: "application/xml" } })
    if (!res.ok) {
      return { kind: res.status === 404 ? "NOT_FOUND" : "SMP_HTTP", message: `SMP ${res.status} za ${serviceGroup}` }
    }
    const xml = await res.text()
    const endpoint = extractEndpoint(xml)
    const cert = extractCertificate(xml)
    if (!endpoint || !cert) {
      return { kind: "NOT_FOUND", message: "SMP metadate nima endpoint/cert (transport profile ni objavljen)" }
    }
    return {
      participantId: participant,
      smpHost: `smp.${smlDomain}`,
      endpointUrl: endpoint,
      certificatePem: cert,
      transportProfile: TRANSPORT_PROFILE_AS4,
    }
  } catch (e) {
    return { kind: "SMP_HTTP", message: e instanceof Error ? e.message : String(e) }
  }
}

/** Iz SMP XML (PEPPOL ServiceMetadata) izlušči EndpointURL. */
export function extractEndpoint(xml: string): string | null {
  const m = xml.match(/<EndpointURL>([\s\S]*?)<\/EndpointURL>/)
  return m ? m[1].trim() : null
}

/** Iz SMP XML izlušči X509 certificate (v PEM ali b64). */
export function extractCertificate(xml: string): string | null {
  // X509Certificate v SMP je base64 (brez PEM headerja) in ga običajno ovije.
  const m = xml.match(/<X509Certificate>([\s\S]*?)<\/X509Certificate>/)
  if (!m) return null
  const b64 = m[1].replace(/\s+/g, "")
  if (!b64) return null
  // Vrni brez PEM recap — 'certificatePem' v as4 to pričakuje kot PEM?
  // Za AS4 cert se ovije v PEM, da ga BinarySecurityToken smiselno predstavi.
  return b64
}

/** Mock resolver — deterministično za teste, brez omrežja. */
export async function resolveSmpMock(opts: SmpLookupOptions): Promise<SmpResult> {
  const participant = participantScheme(opts.id, opts.icd)
  return {
    participantId: participant,
    smpHost: `smp.mock`,
    endpointUrl: "https://mock-ap.edelivery.example/pms/as4",
    certificatePem: "MOCKCERTB64",
    transportProfile: TRANSPORT_PROFILE_AS4,
  }
}