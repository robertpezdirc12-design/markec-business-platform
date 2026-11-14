// ============================================================
// F5.5.4.6.2 — SOLUGA E-RAČUNOV (server akcije).
//
// Generiranje e-računov (INVOICE/ADVANCE prek Document, CREDIT prek
// CreditNote), validacija, NESPREMENLJIV arhiv (SHA-256), prenos.
// Pošiljanje/prejemanje NISO implementirana — le podatkovna podlaga in
// vmesnik za poznejše kanale.
// ============================================================

"use server"

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { createHash } from "node:crypto"
import { EInvoiceFormat, EInvoiceKind } from "@/lib/einvoice/model"
import { buildEInvoiceModel } from "@/lib/einvoice/exporter"
import { buildUbl21Xml } from "@/lib/einvoice/ubl21"
import { buildEslog20Xml } from "@/lib/einvoice/eslog20"
import { validateEInvoice, EInvoiceValidationResult } from "@/lib/einvoice/validate"
import { validateOfficial } from "@/lib/einvoice/official"
import { encryptSecret, decryptSecret, redact } from "@/lib/einvoice/secrets"
import { formatLabel } from "@/lib/einvoice/format"
import { writeFile, mkdir } from "node:fs/promises"
import * as path from "node:path"

function sha256hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex")
}

const VAL_TMP = path.join(process.cwd(), "docs", "einvoicing", "artifacts", "validator", "tmp")
let tmpSeen = false
async function ensureTmp() {
  if (!tmpSeen) { await mkdir(VAL_TMP, { recursive: true }); tmpSeen = true }
}

export interface GenerateEInvoiceResult {
  ok: boolean
  error?: string
  id?: string
  sha256?: string
  format?: string
  kind?: string
  docCode?: string
  validated?: boolean
  validation?: EInvoiceValidationResult | null
  alreadyExists?: boolean
}

function kindFromDocumentType(type: string, isCredit: boolean): EInvoiceKind {
  if (isCredit) return "CREDIT"
  return type === "ADVANCE" ? "ADVANCE" : "INVOICE"
}

/**
 * Generira e-račun za izdan dokument (INVOICE/ADVANCE) ali dobropis (CreditNote)
 * v izbranem formatu, ga validira in nespremenljivo arhivira. Idempotentna:
 * ponovni klic istega (document, format, kind) vrne obstoječi arhiv (istovetni SHA-256).
 */
export async function generateEinvoice(
  documentId: string,
  format: EInvoiceFormat,
  opts: { isCredit?: boolean } = {}
): Promise<GenerateEInvoiceResult> {
  const { org, session } = await requirePermissionOrg("finances.view")

  const isCredit = opts.isCredit === true
  const doc = await prisma.document.findFirst({
    where: { id: documentId, organizationId: org.id },
    include: { items: { orderBy: { position: "asc" } }, customer: true },
  })
  if (!doc) return { ok: false, error: "NOT_FOUND" }
  if (doc.status === "DRAFT") return { ok: false, error: "NOT_ISSUED" }

  const kind: EInvoiceKind = kindFromDocumentType(doc.type, isCredit)

  let creditNote = null as Prisma.CreditNoteGetPayload<true> | null
  if (isCredit) {
    creditNote = await prisma.creditNote.findFirst({
      where: { organizationId: org.id, invoiceId: doc.id, status: "ISSUED" },
      orderBy: { issuedAt: "desc" },
    })
    if (!creditNote) return { ok: false, error: "CREDIT_NOT_FOUND" }
  }

  // Idempotency: že arhivirano? Vrni obstoječi (nespremenljiv).
  const existing = await prisma.eInvoice.findUnique({
    where: {
      organizationId_documentId_format_kind: { organizationId: org.id, documentId: doc.id, format, kind },
    },
  })
  if (existing) {
    return {
      ok: true,
      alreadyExists: true,
      id: existing.id,
      sha256: existing.sha256,
      format: existing.format,
      kind: existing.kind,
      docCode: existing.docCode,
      validated: existing.xmlValidatedXsd && existing.xmlValidatedBusiness,
    }
  }

  // Nevtralni model + izbrani adapter.
  const { model, warnings } = await buildEInvoiceModel(
    org.id,
    isCredit ? { kind: "CREDIT", document: doc, creditNote: creditNote! } : { kind: doc.type === "ADVANCE" ? "ADVANCE" : "INVOICE", document: doc }
  )
  const xml = format === "ESLOG_2" ? buildEslog20Xml(model) : buildUbl21Xml(model)
  const validation = validateEInvoice(xml, model)
  const allMessages = [...warnings, ...validation.errors, ...validation.warnings]

  // F5.5.4.6.3 — uradna validacija (XSD + PEPPOL/CEN Schematron / e-SLOG) lokalno.
  // Pošteno: NO lažni PASS — kadar Java/artefakti niso dosegljivi → NOT_VERIFIED.
  await ensureTmp()
  const tmpPath = path.join(VAL_TMP, `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}.xml`)
  await writeFile(tmpPath, xml, "utf8")
  let official
  try {
    official = await validateOfficial({
      xml,
      xmlPath: tmpPath,
      isCreditNote: kind === "CREDIT",
      standard: format === "ESLOG_2" ? "eSLOG-2.0" : "PEPPOL-BIS-3.0.21",
    })
  } catch (e) {
    official = await setNotVerified()
  }

  // Poslovna + matematična skladnost (vedno localno).
  const businessOk = validation.mathConsistent && validation.businessOk

  // Če poslovna validacija ni uspela, kljub temu arhiviramo (nespremenljiv
  // izhod) vendar z `validated=false` in messages — uporabnik vidi, da XML
  // še ni VALIDADO. Ne blokiramo arhiviranja (shranimo original).
  const archived = await prisma.$transaction(async (tx) => {
    const row = await tx.eInvoice.create({
      data: {
        organizationId: org.id,
        documentId: doc.id,
        kind,
        format,
        docCode: model.docCode,
        xml: Buffer.from(xml, "utf8").toString("base64"),
        sha256: sha256hex(xml),
        size: Buffer.byteLength(xml, "utf8"),
        xmlValidatedXsd: official.status === "VALIDATED" || official.xsdStatus === "PASS",
        xmlValidatedBusiness: businessOk,
        validationMessages: JSON.stringify([...allMessages, ...official.xsdErrors, ...official.peppolErrors]),
        status:
          official.status === "VALIDATED" && businessOk
            ? "VALIDATED"
            : official.status === "NOT_VERIFIED"
              ? "PREPARED"
              : "INVALID",
        standardVersion: official.standard,
        validatorVersion: official.validatorVersion,
        xsdApplied: official.xsdStatus !== "NOT_VERIFIED",
        peppolSchematronApplied: official.peppolStatus !== "NOT_VERIFIED",
        generatedById: session?.user?.id ?? null,
      },
    })
    await tx.eInvoiceDeliveryEvent.create({
      data: {
        organizationId: org.id,
        einvoiceId: row.id,
        kind: "GENERATED",
        message: `E-račun generiran (${formatLabel(format)})`,
        actorUserId: session?.user?.id ?? null,
      },
    })
    await tx.eInvoiceReceipt.create({
      data: {
        organizationId: org.id,
        einvoiceId: row.id,
        kind: "LOCAL_GENERATED",
        status: official.status === "VALIDATED" && businessOk ? "VALID" : official.status === "NOT_VERIFIED" ? "UNVERIFIED" : "INVALID",
        message: allMessages.length ? JSON.stringify(allMessages) : null,
      },
    })
    return row
  })

  revalidatePath("/dashboard/einvoices")
  return {
    ok: true,
    id: archived.id,
    sha256: archived.sha256,
    format: archived.format,
    kind: archived.kind,
    docCode: archived.docCode,
    validated: archived.xmlValidatedXsd && archived.xmlValidatedBusiness,
    validation,
  }
}

/** Pošten fallback, ko uradnega validatorja ni mogoče izvesti. */
async function setNotVerified(): Promise<Awaited<ReturnType<typeof validateOfficial>>> {
  const m = await import("@/lib/einvoice/official")
  return {
    available: false,
    ok: false,
    standard: "unknown",
    xsdStatus: "NOT_VERIFIED",
    peppolStatus: "NOT_VERIFIED",
    status: "NOT_VERIFIED",
    xsdErrors: ["Uradni validator ni bilo mogoče izvesti."],
    peppolErrors: [],
    cenErrors: [],
    validatorVersion: "none",
  }
}

/** Seznam nespremenljivo arhiviranih e-računov organizacije (za UI). */
export async function listEinvoices() {
  const { org } = await requirePermissionOrg("finances.view")
  const rows = await prisma.eInvoice.findMany({
    where: { organizationId: org.id },
    include: { events: { orderBy: { createdAt: "desc" }, take: 5 } },
    orderBy: { createdAt: "desc" },
  })
  return rows.map((r) => ({
    id: r.id,
    documentId: r.documentId,
    kind: r.kind,
    format: r.format,
    docCode: r.docCode,
    sha256: r.sha256,
    size: r.size,
    xmlValidatedXsd: r.xmlValidatedXsd,
    xmlValidatedBusiness: r.xmlValidatedBusiness,
    xsdApplied: r.xsdApplied,
    peppolSchematronApplied: r.peppolSchematronApplied,
    standardVersion: r.standardVersion,
    validatorVersion: r.validatorVersion,
    validationMessages: r.validationMessages,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    events: r.events.map((e) => ({ kind: e.kind, message: e.message, createdAt: e.createdAt.toISOString() })),
  }))
}

/** Prenos originalnega XML (org-scoped, IDOR-varano). */
export async function downloadEinvoice(einvoiceId: string): Promise<{ xml: string; sha256: string; filename: string } | null> {
  const { org } = await requirePermissionOrg("finances.view")
  const row = await prisma.eInvoice.findFirst({
    where: { id: einvoiceId, organizationId: org.id },
  })
  if (!row) return null
  const xml = Buffer.from(row.xml, "base64").toString("utf8")
  // Preveri integriteto: SHA-256 mora sovpadati.
  if (sha256hex(xml) !== row.sha256) return null
  return { xml, sha256: row.sha256, filename: `${row.docCode}.${row.kind === "CREDIT" ? "credit" : "invoice"}.xml` }
}

/** Konfiguracija kanala — SAMO vmesnik (pošiljanje v naslednji fazi). */
export async function getEinvoiceChannels() {
  const { org } = await requirePermissionOrg("finances.view")
  return prisma.eInvoiceChannelConfig.findMany({ where: { organizationId: org.id } })
}

/**
 * F5.5.4.6.4 — shrani (ali posodobi) org-scoped ponudniški kanal. Poverilnice so
 * ŠIFRIRANE (AES-256-GCM) prek secrets.ts; v DB nikoli ne shranimo čistih.
 * Poverilnic ne vračamo naprej. Dejansko pošiljanje NI sproženo.
 */
export async function saveEinvoiceChannel(input: {
  channel: string
  label: string
  providerEndpoint?: string | null
  credentials?: Record<string, string>
  config?: Record<string, unknown>
}) {
  const { org } = await requirePermissionOrg("finances.view")

  // Šifriraj vsako neobčutljivo poverilnico posebej v en JSON payload.
  const secretPayload = input.credentials && Object.keys(input.credentials).length
    ? encryptSecret(JSON.stringify(input.credentials))
    : null

  const config = input.config ?? {}
  const row = await prisma.eInvoiceChannelConfig.upsert({
    where: { organizationId_channel: { organizationId: org.id, channel: input.channel } },
    create: {
      organizationId: org.id,
      channel: input.channel,
      label: input.label,
      status: "PENDING",
      providerEndpoint: input.providerEndpoint ?? null,
      encryptedSecret: secretPayload,
      encryptedKeyRef: input.channel, // ločen ref ključa (identifikator v DB, ne sam secret)
      config: config as Prisma.InputJsonValue,
    },
    update: {
      label: input.label,
      providerEndpoint: input.providerEndpoint ?? null,
      ...(secretPayload ? { encryptedSecret: secretPayload, encryptedKeyRef: input.channel } : {}),
      config: config as Prisma.InputJsonValue,
    },
  })
  revalidatePath("/dashboard/einvoices")
  return { ok: true, id: row.id, channel: row.channel, label: row.label }
}

/** Vrni kanale z redakcijo poverilnic (nikoli poln secret; samo tag za prikaz). */
export async function listEinvoiceChannelsRedacted() {
  const { org } = await requirePermissionOrg("finances.view")
  const rows = await prisma.eInvoiceChannelConfig.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: "asc" } })
  return rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    label: r.label,
    status: r.status,
    providerEndpoint: r.providerEndpoint,
    // nikoli polne poverilnice; samo ali je nastavljena
    hasCredentials: Boolean(r.encryptedSecret),
    redactedCredential: r.encryptedSecret ? redact(String(r.encryptedSecret)) : "",
    config: r.config,
    createdAt: r.createdAt.toISOString(),
  }))
}

/** Preberi dešifrirane poverilnice (samo za interno kanalno obdelavo; klicev ne vračaj). */
export async function readChannelCredentials(channel: string): Promise<Record<string, string> | null> {
  const { org } = await requirePermissionOrg("finances.view")
  const row = await prisma.eInvoiceChannelConfig.findFirst({ where: { organizationId: org.id, channel } })
  const dec = decryptSecret(row?.encryptedSecret ?? null)
  if (!dec) return null
  try { return JSON.parse(dec) } catch { return null }
}