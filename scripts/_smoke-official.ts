import { validateOfficial } from "../src/lib/einvoice/official"
import { promises as fs } from "node:fs"
import * as path from "node:path"

async function main() {
  const xmlPath = path.join(process.cwd(), "docs", "einvoicing", "test-samples", "00-ubl-invoice-380-valid.xml")
  const xml = await fs.readFile(xmlPath, "utf8")
  const r = await validateOfficial({ xml, xmlPath, isCreditNote: false, standard: "PEPPOL-BIS-3.0.21" })
  console.log("mode=", process.env.EINVOICE_VALIDATOR ?? "auto", "available=", r.available, "ok=", r.ok, "xsd=", r.xsdStatus, "peppol=", r.peppolStatus, "status=", r.status)
}
main().catch((e) => { console.error(e); process.exit(1) })