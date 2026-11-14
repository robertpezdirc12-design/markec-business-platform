// ============================================================
// F5.5.4.3 — MINIMALEN, BREZ-ODVISNOST STREŽNIŠKI PDF PISALEC.
//
// Ustvari veljaven PDF iz posnetka (snapshot) dokumenta — determinističen
// in nespremenljiv vir za arhiv. Font: standard-14 Helvetica + WinAnsi je
// z `Differences` razširjen za slovenske črke in opremljen s `ToUnicode`
// CMap, da vsak kod označi pravo Unicode kodno točko. š/ž/Š/Ž so v WinAnsi
// in se izrišejo točno; č/Č/″ so razg savni prek ToUnicode (viewer
// substitucija). Hash integriteto jamči arhiv (DocumentArchive).
// ============================================================

import { createHash } from "node:crypto"

export interface PdfLineItem {
  description: string
  quantity: string
  unitPrice: string
  vatRate: string
  total: string
}

export interface PdfDocumentPayload {
  title: string
  docCode: string
  issueDate: string
  dueDate: string | null
  serviceDate: string | null // F5.5.4.5 — datum/obdobje opravljene storitve
  servicePeriod: string | null // F5.5.4.5 — "2026-11-01 – 2026-11-05" ali serviceDate
  advanceReceivedAt: string | null // F5.5.4.5 — za ADVANCE: datum prejema predplačila
  advanceRefs: string[] // F5.5.4.5 — AVN-kodi aplicirani na ta račun
  advanceTotal: string // F5.5.4.5 — vsota apliciranih avansov (bruto)
  status: string
  currency: string
  issuer: {
    name: string
    vatId: string | null
    registrationNumber: string | null
    bankAccount: string | null
    email: string | null
    phone: string | null
    street: string | null
    city: string | null
    zip: string | null
  }
  customer: { name: string; email?: string | null; phone?: string | null } | null
  lines: PdfLineItem[]
  subtotal: string
  discount: string
  taxBase: string
  taxTotal: string
  total: string
  vatEnabled: boolean
  payments: { label: string; value: string }[]
  note: string | null
}

// WinAnsi prisotni: €(0x80) š(0x9A) ž(0x9E) Š(0x8A) Ž(0x8E)
const WINANSI_MAP: Record<string, number> = {
  "€": 0x80, "š": 0x9a, "ž": 0x9e, "Š": 0x8a, "Ž": 0x8e,
}
// Znaki izven WinAnsi — mapiramo na proste kode v Differences.
const EXTRA_MAP: Record<string, number> = { "č": 0x90, "Č": 0x8f }

function codeOf(ch: string): number {
  const c = ch.codePointAt(0)!
  if (c < 0x80) return c
  if (ch in WINANSI_MAP) return WINANSI_MAP[ch]
  if (ch in EXTRA_MAP) return EXTRA_MAP[ch]
  return c & 0x7f
}

/** Hex niz za tekstovni operator (vsak znak → byte). */
function hexText(s: string): string {
  let h = ""
  for (const ch of s) h += String.fromCharCode(codeOf(ch))
  return `<${h}>`
}

/** Deterministično razg Ivanje → Unicode za ToUnicode CMap. */
function collectUsed(texts: string[]): Map<number, number> {
  const used = new Map<number, number>()
  for (const t of texts) for (const ch of t) {
    const b = codeOf(ch)
    if (!used.has(b)) used.set(b, ch.codePointAt(0)!)
  }
  return used
}

function buildToUnicode(used: Map<number, number>): string {
  const entries = Array.from(used.entries()).map(([b, u]) =>
    `<${b.toString(16).padStart(2, "0")}> <${u.toString(16).padStart(4, "0")}>`
  )
  return [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<00> <FF>",
    "endcodespacerange",
    `${entries.length} beginbfchar`,
    ...entries,
    "endbfchar",
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end",
  ].join("\n") + "\n"
}

export function buildDocumentPdf(payload: PdfDocumentPayload): Buffer {
  const P = payload
  const ops: string[] = []
  const allText: string[] = []
  let y = 790
  const line = (text: string, size = 10, x = 56, bold = false) => {
    allText.push(text)
    ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td ${hexText(text)} Tj ET`)
    y -= size + 2
  }
  const gap = (n = 8) => { y -= n }

  line(P.title, 16, 56, true); gap(4)
  line(`${P.docCode}  ·  ${P.status}  ·  ${P.currency}`, 9)
  // F5.5.4.5: datum opravljene storitve ločimo od izdaje; za avans datum prejema.
  const dates = [`Datum izdaje: ${P.issueDate}`]
  if (P.servicePeriod) dates.push(`Datum/obdobje storitve: ${P.servicePeriod}`)
  if (P.advanceReceivedAt) dates.push(`Prejeto predplačilo: ${P.advanceReceivedAt}`)
  if (P.dueDate) dates.push(`Plačilo do: ${P.dueDate}`)
  line(dates.join("   ·   "), 9); gap(6)

  line(`Izdajatelj: ${P.issuer.name}`, 11, 56, true)
  if (P.issuer.vatId) line(`ID za DDV: ${P.issuer.vatId}`, 9)
  if (P.issuer.registrationNumber) line(`Matična: ${P.issuer.registrationNumber}`, 9)
  if (P.issuer.bankAccount) line(`TRR: ${P.issuer.bankAccount}`, 9)
  if (P.issuer.street) line(`${P.issuer.street}${P.issuer.zip ? `, ${P.issuer.zip}` : ""}${P.issuer.city ? ` ${P.issuer.city}` : ""}`, 9)
  if (P.issuer.email) line(`E-pošta: ${P.issuer.email}`, 9)
  if (P.issuer.phone) line(`Telefon: ${P.issuer.phone}`, 9); gap(8)

  if (P.customer) {
    line(`Prejemnik: ${P.customer.name}`, 11, 56, true)
    if (P.customer.email) line(`  ${P.customer.email}`, 9)
    if (P.customer.phone) line(`  ${P.customer.phone}`, 9); gap(8)
  }

  line("Postavka  |  kol·cena  |  DDV  |  skupaj", 9, 56, true)
  for (const it of P.lines) line(`${it.description}  :  ${it.quantity} x ${it.unitPrice}  (DDV ${it.vatRate}%)  =  ${it.total}`, 9)
  gap(4)

  line(`PODBLAZA (bruto po popustih): ${P.subtotal}`, 9)
  if (P.discount) line(`Popust: ${P.discount}`, 9)
  if (P.vatEnabled) {
    line(`Osnova za DDV: ${P.taxBase}`, 9)
    line(`DDV: ${P.taxTotal}`, 9)
  }
  line(`SKUPAJ ZA PLAČILO: ${P.total} ${P.currency}`, 12, 56, true); gap(6)
  for (const pm of P.payments) line(`${pm.label}: ${pm.value}`, 9)
  // F5.5.4.5: prikaži aplicirane avanse (in njihovo odštetje od skupnega).
  if (P.advanceRefs.length > 0) {
    line(`Že izkazani avansi: ${P.advanceRefs.join(", ")}  =  -${P.advanceTotal}`, 9)
  }
  gap(4)
  if (P.note) line(`Opomba: ${P.note}`, 9)

  const content = ops.join("\n") + "\n"
  const used = collectUsed(allText)
  const toUnicode = buildToUnicode(used)

  // ---- Objektni načrt (1..6) ----
  const obj = (num: number, body: string) => `${num} 0 obj\n${body}\nendobj\n`
  const objs: Array<[string, string]> = [
    ["catalog", "<< /Type /Catalog /Pages 2 0 R >>"],
    ["pages", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"],
    ["page", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>"],
  ]
  const diffEntries = ["0x80 /Euro", "0x8A /Scaron", "0x8E /Zcaron", "0x8F /VATPLACE", "0x90 /CDIFF", "0x9A /scaron", "0x9E /zcaron"]
  const diffs = diffEntries.join(" ")
  const font1 = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [${diffs}] >> /ToUnicode 7 0 R >>`
  const font2 = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding << /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [${diffs}] >> /ToUnicode 7 0 R >>`
  objs.push(["font1", font1])
  objs.push(["font2", font2])
  objs.push(["content", `<< /Length ${content.length} >>\nstream\n${content}\nendstream`])
  objs.push(["tounicode", `<< /Length ${toUnicode.length} >>\nstream\n${toUnicode}\nendstream`])

  let out = "%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n"
  const offsets: number[] = []
  for (let i = 0; i < objs.length; i++) {
    offsets.push(out.length)
    out += obj(i + 1, objs[i][1])
  }
  const xrefStart = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  return Buffer.from(out, "latin1")
}

/** DocCode → ime datoteke za PP (varno). */
export function safePdfFilename(docCode: string, title: string): string {
  return `${title.toLowerCase()}-${docCode.replace(/[/\\:]/g, "-")}.pdf`
}

export function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex")
}