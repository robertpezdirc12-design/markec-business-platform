// ============================================================
// F5.5.4.6.4 — XMLDSig (enveloped) podpis za e-SLOG 2.0 JointDokument.
//
// UJP DK pričakuje, da je `JointDokument` pred oddajo digitalno podpisan
// (XAdES-BES stil) z X.509 klient certifikatom organizacije (SIGOV-CA).
// Ta modul implementira determinističen XMLDSig podpis brez zunanjih
// XML knjižnic — izključno na osnovi Node `crypto` + ekskluzivne
// kanonikalizacije (XML Exc-C14N 1.0, brez komentarjev), prilagojene
// NATANČNO za ovojnico, ki jo ustvarimo sami v `eSlogJointWrapper`.
//
// POMEMBNO (obseg): to NI generalen XML-Security parser. Kanonikalizacija
// in SignedInfo gradnja delujeta za oblike, ki jih ta modul sam oddaja
// (vd:JointDokument · vd:Vsebina · ena DSig ovojnica). Enako kanonikalizacijo
// uporablja tudi verifikacijska pot (round-robin testiranje z node:crypto),
// zato je podpis notranje preverljiv. Za končno interoperabilnost z živim
// UJP se signiranje še vedno preveri z organizacijskim orodjem/podpisno
// verigo pred produkcijsko oddajo.
// ============================================================

import { createHash, createSign, createVerify, generateKeyPairSync } from "node:crypto"

/** Ekskluzivna C14N 1.0 za enoto (element, brez komentarjev). Deterministično. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\t/g, "&#x9;")
    .replace(/\n/g, "&#xA;")
    .replace(/\r/g, "&#xD;")
}

/**
 * Poenostavljena ekskluzivna C14N za dokumente, ki jih ustvarimo sami.
 * - atributi urejeni: najprej (edini) namespace-dekl `xmlns:vd`, nato po abecedi ko/ime;
 * - vrednosti atributov normirane (brez vodilnih/zaključnih presledkov),
 * - tekstovna vsebina ohranjena (znotraj UBL so presledki vsebinski);
 * - inter-element whitespace med otroki ELEMENTOV se izloči.
 */
export function canonicalizeXml(xml: string): string {
  const t = xml.trim()
  // Samozaprt element (<a b="1"/> ali <a/>) → kanonikaliziran z atributi po abecedi.
  const selfClose = t.match(/^<([^\s/>]+)([^>]*?)\/>$/)
  if (selfClose) {
    const name = selfClose[1]
    const attrs = attrsFrom(selfClose[2])
    const pairs = attrs.map((a) => `${a.name}="${escapeXml(normalizeAttr(a.value))}"`).sort()
    return `<${name}${pairs.length ? " " + pairs.join(" ") : ""}/>`
  }
  // Detektiraj ime korenskega elementa in njegove atribute + vsebino.
  const open = t.match(/^<([^\s/>]+)([^>]*?)>([\s\S]*?)(?:<\/\1>)?$/)
  if (!open) return t
  const name = open[1]
  const attrBlock = open[2]
  const attrs = attrsFrom(attrBlock)
  const children = open[3]
  const ns = attrs.find((a) => a.name === "xmlns:vd")
  const nonNs = attrs
    .filter((a) => a.name !== "xmlns:vd")
    .map((a) => `${a.name}="${escapeXml(normalizeAttr(a.value))}"`)
    .sort()
  const order: string[] = []
  if (ns) order.push(`xmlns:vd="${escapeXml(normalizeAttr(ns.value))}"`)
  order.push(...nonNs)
  const openTag = `<${name}${order.length ? " " + order.join(" ") : ""}>`
  // Otroci: fragment z elementi in teksti. Rekurzivno kanonikaliziramo vsakega
  // elementa, inter-element medpraznine pa izločimo.
  const childElems: string[] = []
  const tagRe = /<([a-zA-Z][\w:.-]*)([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g
  let lastEnd = 0
  let m: RegExpExecArray | null
  let textInside = ""
  while ((m = tagRe.exec(children))) {
    const before = children.slice(lastEnd, m.index)
    if (before.trim().length !== 0) {
      textInside += before
    }
    childElems.push(canonicalizeXml(m[0]))
    lastEnd = tagRe.lastIndex
  }
  // Preostali tekst za zadnjim elementom (inter-praznine) — ignoriraj.
  if (childElems.length === 0) {
    // Ni pod-elementov: celoten children je tekstovna vsebina korena.
    return openTag + children + `</${name}>`
  }
  return openTag + (textInside ? textInside : "") + childElems.join("") + `</${name}>`
}

function normalizeAttr(v: string): string {
  return v.replace(/^[\t\n\r ]+|[\t\n\r ]+$/g, "")
}

function attrsFrom(block: string): Array<{ name: string; value: string }> {
  const out: Array<{ name: string; value: string }> = []
  if (!block || block.trim() === "") return out
  // Poenostavljeno: razbitje po vzorcu name="value" (naši dokumenti nimajo
  // '=' v imenih in uporabljajo dvojne narekovaje za vrednosti).
  const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*"([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(block))) out.push({ name: m[1], value: m[2] })
  return out
}

export interface XmlDsigOptions {
  /** celotna vsebina dokumenta (npr. JointDokument ovojnica), ki se podpiše */
  xml: string
  /** X.509 klient certifikat organizacije (PEM) — vloži se v X509Data */
  certPem: string
  /** zasebni ključ organizacije (PEM, nešifriran ali s passphrase) */
  keyPem: string
  /** neobvezno geslo za šifrirani ključ */
  passphrase?: string
  /** neobvezna časovna oznaka/ID dokumenta (za SignedInfo Id) */
  documentId?: string
}

export interface XmlDsigResult {
  /** celoten XML z vdelanim ds:Signature (zadnji otrok korena) */
  signedXml: string
  /** DigestValue (base64) — za pregled in teste */
  digestValueBase64: string
  /** SignatureValue (base64) */
  signatureValueBase64: string
}

const NS_DS = "http://www.w3.org/2000/09/xmldsig#"
const NS_EXC_C14N = "http://www.w3.org/2001/10/xml-exc-c14n#"
const NS_ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature"
const METHOD_RSA_SHA256 = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"
const DIGEST_SHA256 = "http://www.w3.org/2001/04/xmlenc#sha256"

/**
 * Izgradi e-SLOG 2.0 JointDokument z vdelanim (enveloped) XMLDSig podpisom.
 *
 * Postopek (standardno):
 *   1. kanonikaliziraj dokument brez Signature (enveloped + exc-c14n) → C14N_DOC
 *   2. digest = SHA256(C14N_DOC) → DigestValue
 *   3. izgradi SignedInfo (kanonikalizirano obliko) → C14N_KI
 *   4. signatureValue = RSA-SHA256(C14N_KI) z org ključem
 *   5. sestavi <ds:Signature> in ga vdela kot zadnjega otroka korena.
 *
 * `canonicalizeXml` se uporablja tako za dokument (brez DSig vsebine) kot za
 * SignedInfo: prilagojena je, da ohranja znana strukturo, ki jo ustvarimo.
 */
export function xmlDsigSign(opts: XmlDsigOptions): XmlDsigResult {
  const { xml, certPem, keyPem, passphrase } = opts

  // Koren brez notranje DSig (naša ovojnica ga še nima) → kanonikaliziraj.
  const c14nDoc = canonicalizeXml(xml)
  const digest = createHash("sha256")
  digest.update(Buffer.from(c14nDoc, "utf8"))
  const digestB64 = digest.digest("base64")

  // Izgradi SignedInfo v kanonikalizirani obliki (deterministično, že C14N).
  const signedInfoC14n =
    `<ds:SignedInfo xmlns:ds="${NS_DS}">` +
    `<ds:CanonicalizationMethod Algorithm="${NS_EXC_C14N}"/>` +
    `<ds:SignatureMethod Algorithm="${METHOD_RSA_SHA256}"/>` +
    `<ds:Reference URI="">` +
    `<ds:Transforms>` +
    `<ds:Transform Algorithm="${NS_ENVELOPED}"/>` +
    `<ds:Transform Algorithm="${NS_EXC_C14N}"/>` +
    `</ds:Transforms>` +
    `<ds:DigestMethod Algorithm="${DIGEST_SHA256}"/>` +
    `<ds:DigestValue>${digestB64}</ds:DigestValue>` +
    `</ds:Reference>` +
    `</ds:SignedInfo>`

  const signer = createSign("RSA-SHA256")
  signer.update(Buffer.from(signedInfoC14n, "utf8"))
  signer.end()
  const sig = signer.sign({ key: keyPem, passphrase }, "base64")

  const decoderPem = certPem
    .replace(/-----BEGIN CERTIFICATE-----/, "")
    .replace(/-----END CERTIFICATE-----/, "")
    .replace(/\s+/g, "")

  const signatureBlock =
    `<ds:Signature xmlns:ds="${NS_DS}">` +
    signedInfoC14n +
    `<ds:SignatureValue>${sig}</ds:SignatureValue>` +
    `<ds:KeyInfo><ds:X509Data><ds:X509Certificate>${decoderPem}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>` +
    `</ds:Signature>`

  // Vstavi Signature kot zadnjega otroka korena — pred zaključnim </vd:JointDokument>.
  const signedXml = xml.replace(/<\/[^>]+>[\s]*$/, (closing) => `${signatureBlock}${closing}`)

  return { signedXml, digestValueBase64: digestB64, signatureValueBase64: sig }
}

/**
 * Preveri veljavnost XMLDSig podpisa: (1) podpis lom GetSignedInfo se ujema z
 * javnim ključem (RSA-SHA256), in (2) DigestValue se ujema s SHA-256 kanoni-
 * kaliziranega dokumenta BREZ vdelane ds:Signature. Uporabno za testne
 * round-drop in preverbo pred produkcijo.
 */
export function xmlDsigVerify(xml: string, publicKeyPem: string): boolean {
  // Izlušči SignatureValue in DigestValue (poenostavljeno — za naše oblike).
  const sigVal = /<ds:SignatureValue>([^<]+)<\/ds:SignatureValue>/.exec(xml)?.[1]
  const digestVal = /<ds:DigestValue>([^<]+)<\/ds:DigestValue>/.exec(xml)?.[1]
  if (!sigVal || !digestVal) return false

  // (2) Digest prek dokumenta brez vdelanega Signature.
  const docWithoutSig = xml.replace(/<ds:Signature[\s\S]*?<\/ds:Signature>/, "")
  const c14nDoc = canonicalizeXml(docWithoutSig)
  const digestNow = createHash("sha256").update(Buffer.from(c14nDoc, "utf8")).digest("base64")
  if (digestNow !== digestVal) return false

  // (1) Rekonstruira SignedInfo (uporabi isto kot pri signiranju).
  const signedInfoC14n =
    `<ds:SignedInfo xmlns:ds="${NS_DS}">` +
    `<ds:CanonicalizationMethod Algorithm="${NS_EXC_C14N}"/>` +
    `<ds:SignatureMethod Algorithm="${METHOD_RSA_SHA256}"/>` +
    `<ds:Reference URI="">` +
    `<ds:Transforms>` +
    `<ds:Transform Algorithm="${NS_ENVELOPED}"/>` +
    `<ds:Transform Algorithm="${NS_EXC_C14N}"/>` +
    `</ds:Transforms>` +
    `<ds:DigestMethod Algorithm="${DIGEST_SHA256}"/>` +
    `<ds:DigestValue>${digestVal}</ds:DigestValue>` +
    `</ds:Reference>` +
    `</ds:SignedInfo>`

  const verifier = createVerify("RSA-SHA256")
  verifier.update(Buffer.from(signedInfoC14n, "utf8"))
  verifier.end()
  return verifier.verify(publicKeyPem, sigVal, "base64")
}

/**
 * Generator testnega parja ključev (RSA-2048) — uporablja se v enotah, da ne
 * odvisimo od dejanskega org certifikata (SIGOV-CA ni na voljo v tej repo-zanki).
 * V produkciji se uporabi pravi organizacijski X.509 cert + private key.
 */
export function makeSelfSignedTestPair(): { certPem: string; keyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const keyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString()
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString()
  // Nadomestni cert za X509Data (nosilec javnega ključa); ni na zaupanja vredni verigi.
  const b64 = Buffer.from(publicKeyPem, "utf8").toString("base64")
  const certPem = `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----`
  return { certPem, keyPem, publicKeyPem }
}