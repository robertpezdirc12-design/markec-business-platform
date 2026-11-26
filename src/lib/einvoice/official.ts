// ============================================================
// F5.5.4.6.3 — Uradna lokalna validacija (XSD + Schematron) prek Java runtime.
//
// Modul `validated` izvaja natančno uradne artefakte:
//   - XSD: JDK 17 vgrajeni JAXP XML Schema 1.0 (Xerces) nad UBL 2.1 shemami.
//   - Schematron: iso-schematron (Schematron.org) + Saxon-HE 12.5 nad
//     PEPPOL-EN16931-UBL.sch in CEN-EN16931-UBL.sch (BIS Billing 3.0.21).
//
// PRINCIP POŠTENOSTI: če runtime ta JAR-i / Java niso dosegljivi (npr. Vercel
// brez Jave), NE izdajamo lažnega PASS. Vrnemo stanje `status:"NOT_VERIFIED"`
// in UI/arhiv sta jasno označena kot "ni uradno validirano".
//
// Deluje deterministično lokalno — ARTEFAKTI se razrešujejo z diska, NI spletnega
// klica ob posameznem računu.
// ============================================================

import { execFile, spawnSync } from "node:child_process"
import { promises as fs, existsSync } from "node:fs"
import * as path from "node:path"

export interface OfficialResult {
  /** engine je dosegljiv in je dejansko izvedel validacijo */
  available: boolean
  /** overall ok (vse izvedene stopnje nič napak) */
  ok: boolean
  /** PEPPOL 3.0.21 / eSLOG-2.0 */
  standard: string
  /** UBL-2.1 / "eSLOG-uradni-neverificiran" */
  xsdStatus: "PASS" | "FAIL" | "NOT_VERIFIED"
  peppolStatus: "PASS" | "FAIL" | "NOT_VERIFIED"
  /** kombinirani status */
  status: "VALIDATED" | "INVALID" | "NOT_VERIFIED"
  xsdErrors: string[]
  peppolErrors: string[]
  cenErrors: string[]
  validatorVersion: string
}

export interface OfficialValidatorInput {
  xml: string
  xmlPath: string   // absolutna pot začasnega xml-ja
  isCreditNote: boolean
  standard: "PEPPOL-BIS-3.0.21" | "eSLOG-2.0"
}

/**
 * Konfiguracija izvajalnega okolja (F5.5.4.6.3.1 §2).
 * - `EINVOICE_VALIDATOR=dev-java` (privzeto ob prisotni Javi): lokalni uradni XSD+Schematron
 *   prek Java JDK-JAXP + Saxon-HE. Primerno za razvoj/test/self-host ali ločen servis.
 * - `EINVOICE_VALIDATOR=off` ali odsotnost Jave in artefaktov: sistem vrne NOT_VERIFIED,
 *   NIKOLI lažni PASS. To je stanje na Vercel (serverless brez Java runtime).
 * Lokalna Java validacija NIKOLI ni izdana kot "produkcijska uradna skladnost" na gostiteljih
 * brez Jave — vedno NOT_VERIFIED.
 */
const VALIDATOR_MODE = (process.env.EINVOICE_VALIDATOR ?? "auto").toLowerCase()
function validatorEnabled(): boolean {
  if (VALIDATOR_MODE === "off") return false
  // "auto": omogoči le če je Java + artefakti na voljo (dev/test).
  return javaAvailable()
}

// ---- poti do lokalnih artefaktov in Java programov ----
// FAZA 3 build (2026-11): statično oblikovan path.join(process.cwd(), ...)
// namesto path.resolve(process.cwd()) — dinamični dostop bi sicer Turbopacku
// pomenil "celo drevo sledi v output" (build warning: whole-project tracing).
const ART = path.join(process.cwd(), "docs", "einvoicing", "artifacts")
const VAL = path.join(ART, "validator")
const XSLT_DIR = path.join(ART, "schematron-xslt")
const UBL_XSD_DIR = path.join(ART, "ubl21", "xsd", "maindoc")
const SCH_PEPPOL = path.join(ART, "peppol-bis3", "PEPPOL-EN16931-UBL.sch")
const SCH_CEN = path.join(ART, "peppol-bis3", "CEN-EN16931-UBL.sch")
const CLASS_DIR = path.join(process.cwd(), "scripts", "einvoice-validator")

const SAXON = path.join(VAL, "Saxon-HE-12.5.jar")
const RESOLVER = path.join(VAL, "xmlresolver.jar")

function javaAvailable(): boolean {
  try {
    const r = spawnSync("java", ["-version"], { encoding: "utf8" })
    return r.status === 0
  } catch {
    return false
  }
}

function run(prog: string, args: string[], _opts: { encoding?: BufferEncoding } = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(prog, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      // err je non-null le za ENOENT / lahko exit!=0; stdout vseeno preberemo.
      resolve({ code: err ? Number((err as NodeJS.ErrnoException).code ?? -1) : 0, stdout: String(stdout), stderr: String(stderr) })
    })
  })
}

// JSON iz zunanjega validatorja (XSD/Schematron); oblika je preverjena v klicih.
interface ValidatorJson {
  ok?: boolean
  errors?: string
  summary?: string
  ran?: string
}
function parseJson(s: string): ValidatorJson | null {
  try { return JSON.parse(s) as ValidatorJson } catch { return null }
}

function cleanErrors(raw: string): string[] {
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("E:") || s.startsWith("F:"))
}

/** Izvede celotno uradno validacijo za en XML. Vrne konzervativen (pošten) rezultat. */
export async function validateOfficial(input: OfficialValidatorInput): Promise<OfficialResult> {
  const isPeppol = input.standard === "PEPPOL-BIS-3.0.21"

  if (!validatorEnabled()) {
    return {
      available: false,
      ok: false,
      standard: input.standard,
      xsdStatus: "NOT_VERIFIED",
      peppolStatus: "NOT_VERIFIED",
      status: "NOT_VERIFIED",
      xsdErrors: ["Validator je onemogočen ali Java ni na voljo v tem izvajalnem okolju (Vercel serverless nima Java). Uradna validacija ni izvedljiva — ni lažnega PASS."],
      peppolErrors: ["Uradni PEPPOL/e-SLOG Schematron ni izveden v tem okolju."],
      cenErrors: [],
      validatorVersion: "none",
    }
  }

  // Preveri prisotnost artefaktov; če manjka → NOT_VERIFIED, ne izmišljuj.
  const required = [
    path.join(CLASS_DIR, "XsdValidator.class"),
    path.join(CLASS_DIR, "SchematronValidator.class"),
    SAXON,
    RESOLVER,
    UBL_XSD_DIR,
  ]
  if (isPeppol) required.push(SCH_PEPPOL, SCH_CEN, XSLT_DIR)
  for (const p of required.slice(0, required.length - 1)) {
    if (!existsSync(p)) {
      return notVerified(input.standard, `manjkajoč validacijski artefakt: ${path.basename(p)}`)
    }
  }

  const xsdFile = input.isCreditNote
    ? path.join(UBL_XSD_DIR, "UBL-CreditNote-2.1.xsd")
    : path.join(UBL_XSD_DIR, "UBL-Invoice-2.1.xsd")

  // ---- 1) XSD ----
  const js = path.join(VAL, "xsd-out.json")
  const xsdRun = await run("java", ["-Dfile.encoding=UTF-8", "-cp", CLASS_DIR, "XsdValidator", xsdFile, input.xmlPath, js], { encoding: "utf8" })
  const xsdJson = parseJson(await fs.readFile(js, "utf8").catch(() => xsdRun.stdout))
  const xsdErrors = xsdJson?.errors?.length ? cleanErrors(String(xsdJson.errors)) : []
  const xsdPass = !!xsdJson?.ok && xsdErrors.length === 0

  // ---- 2) PEPPOL + CEN Schematron (samo za PEPPOL standard) ----
  // e-SLOG: uradni e-SLOG 2.0 XSD + UJP validator NISO bili dosegljivi → NOT VERIFIED
  // (pošteno: NIKOLI ne označimo PASS, če uradnega artefakta ni).
  if (!isPeppol) {
    return {
      available: true,
      ok: xsdPass,
      standard: input.standard,
      xsdStatus: "NOT_VERIFIED",
      peppolStatus: "NOT_VERIFIED",
      status: "NOT_VERIFIED",
      xsdErrors: ["e-SLOG 2.0 uradni XSD + UJP ovojnica niso na voljo (uradni vir ni dosegljiv) — e-SLOG ni XSD-uradno validiran."],
      peppolErrors: ["e-SLOG 2.0 uradni (UJP) validator ni na voljo."],
      cenErrors: [],
      validatorVersion: "eSLOG-uradni-NOT_VERIFIED",
    }
  }

  void xsdPass // e-SLOG XSD ni relevanten (uradni e-SLOG XSD manjka)

  const pj = path.join(VAL, "peppol-out.json")
  const peppolRun = await run(
    "java",
    ["-Dfile.encoding=UTF-8", "-cp", `${SAXON};${RESOLVER};${CLASS_DIR}`, "SchematronValidator", XSLT_DIR, SCH_PEPPOL, input.xmlPath, pj],
    { encoding: "utf8" }
  )
  const pepJson = parseJson(await fs.readFile(pj, "utf8").catch(() => peppolRun.stdout))
  const peppolViol = pepJson?.summary ? JSON.parse(String(pepJson.summary)) : []
  const peppolErrors = extractFatal(peppolViol)
  const peppolPass = pepJson?.ran === "true" && peppolErrors.length === 0

  const cj = path.join(VAL, "cen-out.json")
  const cenRun = await run(
    "java",
    ["-Dfile.encoding=UTF-8", "-cp", `${SAXON};${RESOLVER};${CLASS_DIR}`, "SchematronValidator", XSLT_DIR, SCH_CEN, input.xmlPath, cj],
    { encoding: "utf8" }
  )
  const cenJson = parseJson(await fs.readFile(cj, "utf8").catch(() => cenRun.stdout))
  const cenViol = cenJson?.summary ? JSON.parse(String(cenJson.summary)) : []
  const cenErrors = extractFatal(cenViol)
  const cenPass = cenJson?.ran === "true" && cenErrors.length === 0

  const allOk = xsdPass && peppolPass && cenPass
  return {
    available: true,
    ok: allOk,
    standard: input.standard,
    xsdStatus: xsdPass ? "PASS" : "FAIL",
    peppolStatus: peppolPass && cenPass ? "PASS" : "FAIL",
    status: allOk ? "VALIDATED" : "INVALID",
    xsdErrors,
    peppolErrors,
    cenErrors,
    validatorVersion: "JDK-JAXP-XSD-1.0 + ISO-Schematron-XSLT2 + Saxon-HE-12.5",
  }
}

function extractFatal(viol: Array<Record<string, unknown>>): string[] {
  if (!Array.isArray(viol)) return []
  return viol
    .filter((v) => String(v.flag ?? "fatal").toLowerCase() !== "warning")
    .map((v) => {
      const id = v.id || ""
      const text = String(v.text ?? "").trim()
      return id ? `${id}: ${text || v.location || ""}`.trim() : text || String(v.location ?? "")
    })
    .filter(Boolean)
}

function notVerified(standard: string, reason: string): OfficialResult {
  return {
    available: false,
    ok: false,
    standard,
    xsdStatus: "NOT_VERIFIED",
    peppolStatus: "NOT_VERIFIED",
    status: "NOT_VERIFIED",
    xsdErrors: [reason],
    peppolErrors: [reason],
    cenErrors: [],
    validatorVersion: "none",
  }
}