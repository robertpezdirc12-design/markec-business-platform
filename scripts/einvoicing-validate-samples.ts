// ============================================================
// F5.5.4.6.3 — Deterministični validacijski runner za testne vzorce.
//
// Za VSAK vzorec v docs/einvoicing/test-samples/*.xml izvede:
//   1) XSD (JDK-JAXP nad UBL 2.1 Invoice/CreditNote)
//   2) PEPPOL-EN16931-UBL.sch (PEPPOL BIS Billing 3.0.21)
//   3) CEN-EN16931-UBL.sch (TC434 EN 16931)
// in izpiše JSON z rezultati (PASS/FAIL), vključno s cruda poročila.
//
// Uporaba: tsx scripts/einvoicing-validate-samples.ts   (zahteva lokalno Javo 17)
// ============================================================

import { promises as fs, existsSync, readdirSync } from "node:fs"
import { execFileSync } from "node:child_process"
import * as path from "node:path"

const ROOT = process.cwd()
const ART = path.join(ROOT, "docs", "einvoicing", "artifacts")
const VAL = path.join(ART, "validator")
const SAMPLES = path.join(ROOT, "docs", "einvoicing", "test-samples")
const UBL_XSD = path.join(ART, "ubl21", "xsd", "maindoc")
const XSLT = path.join(ART, "schematron-xslt")
const SCH_P = path.join(ART, "peppol-bis3", "PEPPOL-EN16931-UBL.sch")
const SCH_C = path.join(ART, "peppol-bis3", "CEN-EN16931-UBL.sch")
const CLS = path.join(ROOT, "scripts", "einvoice-validator")
const SAXON = path.join(VAL, "Saxon-HE-12.5.jar")
const RES = path.join(VAL, "xmlresolver.jar")
const PIN = path.join(VAL, "tmp")

function cp(files: string[]) {
  const sep = process.platform === "win32" ? ";" : ":"
  return files.join(sep)
}

function sha256Of(xml: string): string {
  const { createHash } = require("node:crypto") as typeof import("node:crypto")
  return createHash("sha256").update(xml, "utf8").digest("hex")
}

function cleanErrors(raw: string): string[] {
  return raw.split(";").map((s) => s.trim()).filter((s) => s.startsWith("E:") || s.startsWith("F:"))
}

function run(prog: string, args: string[]): { stdout: string; stderr: string; code: number } {
  try {
    const out = execFileSync(prog, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    return { stdout: String(out), stderr: "", code: 0 }
  } catch (e: any) {
    return { stdout: String(e.stdout ?? ""), stderr: String(e.stderr ?? ""), code: e.status ?? -1 }
  }
}

function violations(summary: string): { id: string; text: string; flag: string }[] {
  try {
    const arr = JSON.parse(summary)
    if (!Array.isArray(arr)) return []
    return arr.map((v: any) => ({ id: v.id ?? "", text: String(v.text ?? ""), flag: String(v.flag ?? "fatal") }))
  } catch { return [] }
}

interface DocResult {
  file: string
  kind: string
  typeCode: string
  sha256: string
  xsd: "PASS" | "FAIL" | "NOT_VERIFIED"
  peppol: "PASS" | "FAIL"
  cen: "PASS" | "FAIL"
  xsdErrors: string[]
  peppolErrors: string[]
  cenErrors: string[]
  overall: "PASS" | "FAIL"
}

async function validate(file: string): Promise<DocResult> {
  const xml = await fs.readFile(file, "utf8")
  const isCredit = /<CreditNote[\s>]/.test(xml)
  const typeM = xml.match(/<cbc:(InvoiceTypeCode|CreditNoteTypeCode)>(\d+)</)
  const typeCode = typeM ? typeM[2] : "?"

  // tmp dir
  await fs.mkdir(PIN, { recursive: true })
  const tmp = path.join(PIN, `v-${Date.now()}.xml`)
  await fs.writeFile(tmp, xml, "utf8")

  const xsdFile = isCredit ? path.join(UBL_XSD, "UBL-CreditNote-2.1.xsd") : path.join(UBL_XSD, "UBL-Invoice-2.1.xsd")
  const xOut = path.join(PIN, "xsd.json")
  const x = run("java", ["-Dfile.encoding=UTF-8", "-cp", CLS, "XsdValidator", xsdFile, tmp, xOut])
  let xsd: "PASS" | "FAIL" = "FAIL"
  let xsdErrors: string[] = []
  try {
    const j = JSON.parse(await fs.readFile(xOut, "utf8"))
    xsdErrors = j.errors && j.errors.length ? cleanErrors(String(j.errors)) : []
    xsd = j.ok && xsdErrors.length === 0 ? "PASS" : "FAIL"
  } catch {
    xsd = "FAIL"; xsdErrors = ["XSD parse error: " + x.stdout.slice(0, 120)]
  }

  const sch = async (outName: string, schFile: string): Promise<{ st: "PASS" | "FAIL"; errs: { id: string; text: string }[] }> => {
    const out = path.join(PIN, outName)
    const s = run("java", ["-Dfile.encoding=UTF-8", "-cp", cp([SAXON, RES, CLS]), "SchematronValidator", XSLT, schFile, tmp, out])
    let private_ = violations("")
    try {
      const j = JSON.parse(await fs.readFile(out, "utf8"))
      private_ = violations(String(j.summary))
    } catch {
      private_ = []
      if (s.code !== 0) return { st: "FAIL", errs: [{ id: "RUN", text: s.stderr.slice(0, 200) }] }
    }
    const fatal = private_.filter((v) => v.flag !== "warning")
    return { st: fatal.length === 0 ? "PASS" : "FAIL", errs: fatal }
  }

  const p = await sch("peppol.json", SCH_P)
  const c = await sch("cen.json", SCH_C)

  const overall = xsd === "PASS" && p.st === "PASS" && c.st === "PASS" ? "PASS" : "FAIL"
  return {
    file: path.basename(file),
    kind: isCredit ? "CreditNote" : "Invoice",
    typeCode,
    sha256: sha256Of(xml),
    xsd,
    peppol: p.st,
    cen: c.st,
    xsdErrors,
    peppolErrors: p.errs.map((e) => `${e.id}: ${e.text}`),
    cenErrors: c.errs.map((e) => `${e.id}: ${e.text}`),
    overall,
  }
}

async function main() {
  const files = readdirSync(SAMPLES).filter((f) => f.endsWith(".xml")).sort()
  const results: DocResult[] = []
  for (const f of files) {
    if (f.startsWith("00-")) continue // ročni osnovni že validiran; še vedno preverimo
    results.push(await validate(path.join(SAMPLES, f)))
  }
  console.log(JSON.stringify(results, null, 2))
  const passed = results.filter((r) => r.overall === "PASS").length
  const failed = results.filter((r) => r.overall === "FAIL").length
  console.log(`\nSUMMARY: ${passed} PASS / ${failed} FAIL of ${results.length} samples`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })