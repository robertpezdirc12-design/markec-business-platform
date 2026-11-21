// ============================================================
// F5.5.4.6.2 — PREVZMNI TESTI ELEKTRONSKIH RAČUNOV.
//
// Dokazujejo: veljaven XML (končni/avans/dobropis), pravilen DDV, kupčevi
// podatki, reference, matematična skladnost, nespremenljivost arhiva
// (SHA-256 enak ob ponovnem prenosu), idempotenca, snapshot zamrszovanje.
// Delujejo na izolirani `markec_einvoice_test`.
// ============================================================

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: null as null | {
    user: { id: string; role: "ADMIN" | "STAFF" | "CLIENTE"; organizationId?: string | null; email?: string | null; name?: string | null }
  },
}))

vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async () => null,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock("next/headers", () => ({ headers: async () => new Headers({}) }))
vi.mock("@/lib/tenant-proof", () => ({ ORG_PROOF_HEADER: "x-org-slug-proof", verifyOrgSlug: async () => true }))

import { __setDnsLookupForTests } from "@/lib/einvoice/endpoint-validation"
import { __setDirectTransportForTests, __setDirectStatusForTests } from "@/lib/einvoice/providers"
import {
  pollPendingDeliveries,
  pollPendingDeliveriesForOrg,
  recordDeliveryFromWebhook,
  MAX_DELIVERY_ATTEMPTS,
} from "@/lib/einvoice/delivery"
import { signWebhookHmac } from "@/lib/einvoice/webhook-hmac"
import { encryptSecret } from "@/lib/einvoice/secrets"
import { prisma } from "@/lib/prisma"
import {
  createDocument,
  changeDocumentStatus,
  recordDocumentPayment,
  issueCreditNote,
} from "@/app/actions/documents"
import {
  generateEinvoice,
  downloadEinvoice,
  listEinvoices,
  submitEinvoice,
} from "@/app/actions/einvoices"
import { EInvoiceFormat } from "@/lib/einvoice/model"
import { isWellFormedXml } from "@/lib/einvoice/validate"

const ORGA = "einv-org-a"
const ORGB = "einv-org-b"
const ADMA = "einv-admin-a"
const ADMB = "einv-admin-b"
const CUST = "einv-cust"

// F5.5.4.6.4 / Faza 3.2 (varnost) — kanalna skrivnost za HMAC podpis webhooka.
const WEBHOOK_SECRET = "phase32-test-webhook-secret"

async function clean() {
  for (const t of ["eInvoiceReceipt", "eInvoiceDeliveryEvent", "eInvoice", "eInvoiceChannelConfig", "eInvoiceSettings"] as const) {
    await (prisma as any)[t].deleteMany({ where: { organizationId: ORGA } }).catch(() => {})
  }
  await prisma.documentArchive.deleteMany({ where: { organizationId: ORGA } }).catch(() => {})
  await prisma.documentItem.deleteMany({ where: { organizationId: ORGA } })
  await prisma.creditNote.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentSequence.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentPayment.deleteMany({ where: { organizationId: ORGA } })
  await prisma.document.deleteMany({ where: { organizationId: ORGA } })
  await prisma.customer.deleteMany({ where: { organizationId: ORGA } })
  await prisma.salonConfig.deleteMany({ where: { organizationId: ORGA } })
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.user.deleteMany({ where: { id: { in: [ADMA, ADMB] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [ORGA, ORGB] } } })
}

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  expect(["markec_einvoice_test", "markec_e2e_test", "markec_it"]).toContain(rows[0].db)
  await clean()
  await prisma.organization.create({ data: { id: ORGA, name: "Salon E", slug: ORGA } })
  await prisma.user.create({ data: { id: ADMA, email: `${ADMA}@f.test`, name: ADMA, role: "ADMIN", organizationId: ORGA } })
  await prisma.organizationMember.create({ data: { organizationId: ORGA, userId: ADMA, role: "ADMIN", isDefault: true } })
  await prisma.salonConfig.create({
    data: {
      organizationId: ORGA, name: "Salon E", address: "Dunajska 10", city: "Ljubljana",
      zipCode: "1000", country: "SI", vatId: "SI12345678", isVatRegistered: true,
      bankAccount: "SI56 0000 0000 0000 000", registrationNumber: "1234567",
    },
  })
  // Org B (za IDOR test) — ustvari se enkrat samo.
  await prisma.organization.create({ data: { id: ORGB, name: "Salon B", slug: ORGB } })
  await prisma.user.create({ data: { id: ADMB, email: `${ADMB}@f.test`, name: ADMB, role: "ADMIN", organizationId: ORGB } })
  await prisma.organizationMember.create({ data: { organizationId: ORGB, userId: ADMB, role: "ADMIN", isDefault: true } })
  // Kupcu vnesemo E-RAČUN polja (B2B kupac — podjetje).
  await prisma.customer.create({
    data: {
      id: CUST, organizationId: ORGA, name: "Ana Novak", email: "ana@x.si", phone: "041",
      customerType: "BUSINESS", legalName: "Ana Novak s.p.", street: "Trg 1", postalCode: "2000",
      city: "Maribor", country: "SI", vatId: "SI87654321", taxNumber: "87654321",
      registrationNumber: "7654321", electronicId: "0088", electronicIdScheme: "0088",
      buyerReference: "PO-2026-001", orderReference: "ORD-100",
    },
  })
})

beforeEach(async () => {
  state.session = { user: { id: ADMA, role: "ADMIN", organizationId: ORGA, email: "a@f.test" } }
  for (const t of ["eInvoiceReceipt", "eInvoiceDeliveryEvent", "eInvoice"] as const) {
    await (prisma as any)[t].deleteMany({ where: { organizationId: ORGA } }).catch(() => {})
  }
  await prisma.documentArchive.deleteMany({ where: { organizationId: ORGA } }).catch(() => {})
  await prisma.documentItem.deleteMany({ where: { organizationId: ORGA } })
  await prisma.creditNote.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentPayment.deleteMany({ where: { organizationId: ORGA } })
  await prisma.document.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentSequence.deleteMany({ where: { organizationId: ORGA } })
  // P1:#1318 — fail-closed DNS blokira ne-rassolve `.example` naslova; v testu
  // injiciramo mock DNS → javni IP + mock transport, da Direct pošlje deterministično.
  __setDnsLookupForTests(async () => [{ address: "93.184.216.34", family: 4 }])
  __setDirectTransportForTests(async () => ({ status: 202, headers: {}, body: "accepted" }))
  __setDirectStatusForTests(null)
})

afterAll(async () => {
  __setDnsLookupForTests(null)
  __setDirectTransportForTests(null)
  __setDirectStatusForTests(null)
  await clean()
  await prisma.$disconnect()
})

const line = (description: string, unitPrice: number, quantity = 1, vatRate = 22) => ({ description, quantity, unitPrice, vatRate })

async function mk(type: "INVOICE" | "ADVANCE", amount: number) {
  const c = await createDocument({ type, customerId: CUST, items: [line("Storitev", amount, 1, 22)] })
  expect(c.ok, c.error).toBe(true)
  const iss = await changeDocumentStatus(c.id!, "ISSUED")
  expect(iss.ok).toBe(true)
  return c.id!
}

describe("F5.5.4.6.2 — e-SLOG 2.0", () => {
  it("končni račun: veljaven XML + DDV + kupčeva identifikacija + ref", async () => {
    const inv = await mk("INVOICE", 100) // neto 81,97, DDV 18,03, bruto 100
    const r = await generateEinvoice(inv, "ESLOG_2" as EInvoiceFormat)
    expect(r.ok).toBe(true)
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/)
    const dl = await downloadEinvoice(r.id!)
    expect(dl).not.toBeNull()
    expect(isWellFormedXml(dl!.xml)).toBe(true)
    expect(dl!.xml).toContain("<eSlog")
    expect(dl!.xml).toContain("<InvoiceTypeCode>380</InvoiceTypeCode>")
    expect(dl!.xml).toContain("81.97")   // DDV osnova
    expect(dl!.xml).toContain("18.03")   // DDV
    expect(dl!.xml).toContain("100.00")  // bruto
    expect(dl!.xml).toContain("SI87654321")   // kupčeva DDV
    expect(dl!.xml).toContain("Ana Novak s.p.") // pravna ime
    expect(dl!.xml).toContain("PO-2026-001")    // referenca kupca
    await expect(downloadEinvoice(r.id!)).resolves.not.toBeNull()
  })
  it("avansni račun: INVTypeCode 386 za ločeno od končnega 380", async () => {
    const adv = await mk("ADVANCE", 150)
    await recordDocumentPayment(adv, { amount: 150, method: "transfer", reference: "REF-A" })
    const r = await generateEinvoice(adv, "ESLOG_2" as EInvoiceFormat)
    expect(r.ok).toBe(true)
    const dl = await downloadEinvoice(r.id!)
    expect(isWellFormedXml(dl!.xml)).toBe(true)
    expect(dl!.xml).toContain("<InvoiceTypeCode>386</InvoiceTypeCode>") // avans (ne 326, ne 380)
  })
  it("dobropis: ločen CreditNote model → XML CreditNote tip 381", async () => {
    const inv = await mk("INVOICE", 200)
    const cn = await issueCreditNote(inv, { amount: 50, reason: "reklamacija" })
    expect(cn.ok).toBe(true)
    // CreditNote zaznamo preko documentId končega računa (isCredit=true).
    const r = await generateEinvoice(inv, "ESLOG_2" as EInvoiceFormat, { isCredit: true })
    expect(r.ok).toBe(true)
    expect(r.kind).toBe("CREDIT")
    const dl = await downloadEinvoice(r.id!)
    expect(isWellFormedXml(dl!.xml)).toBe(true)
    expect(dl!.xml).toContain("<CreditNote")
    expect(dl!.xml).toContain("<InvoiceTypeCode>381</InvoiceTypeCode>")
    expect(dl!.xml).toContain("RAC-0001") // reference na original
  })
})

describe("F5.5.4.6.2 — UBL 2.1 / PEPPOL BIS 3.0.x", () => {
  it("končni račun: UBL namespace + DDV + buyer + plačilo", async () => {
    const inv = await mk("INVOICE", 100)
    const r = await generateEinvoice(inv, "UBL21_PEPPOL_3" as EInvoiceFormat)
    expect(r.ok).toBe(true)
    const dl = await downloadEinvoice(r.id!)
    expect(isWellFormedXml(dl!.xml)).toBe(true)
    expect(dl!.xml).toContain("urn:oasis:names:specification:ubl:schema:xsd:Invoice-2")
    expect(dl!.xml).toContain("<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>")
    expect(dl!.xml).toContain("<cbc:ID>RAC-0001")
    expect(dl!.xml).toContain("81.97")
    expect(dl!.xml).toContain("18.03")
  })
  it("nespremenljivost: ponovni generate vrne ISTI SHA-256 (idempotenca)", async () => {
    const inv = await mk("INVOICE", 120)
    const r1 = await generateEinvoice(inv, "UBL21_PEPPOL_3" as EInvoiceFormat)
    const r2 = await generateEinvoice(inv, "UBL21_PEPPOL_3" as EInvoiceFormat)
    expect(r2.alreadyExists).toBe(true)
    expect(r2.sha256).toBe(r1.sha256)
    const dl1 = await downloadEinvoice(r1.id!)
    const dl2 = await downloadEinvoice(r2.id!)
    expect(dl1!.xml).toBe(dl2!.xml) // byte-identičen XML
  })
  it("validacija: math skladnost — Σ DDV == taxTotal; osnova 81.97 za 100 (22%)", async () => {
    const inv = await mk("INVOICE", 100)
    const r = await generateEinvoice(inv, "UBL21_PEPPOL_3" as EInvoiceFormat)
    expect(r.validation).toBeDefined()
    expect(r.validation!.wellFormed).toBe(true)
    expect(r.validation!.mathConsistent).toBe(true)
  })
})

describe("F5.5.4.6.2 — arhiv, izolacija, org-scoped", () => {
  it("arhiv vsebuje EInvoiceDeliveryEvent GENERATED in se ne prepiše", async () => {
    const inv = await mk("INVOICE", 90)
    await generateEinvoice(inv, "ESLOG_2" as EInvoiceFormat)
    const evts = await prisma.eInvoiceDeliveryEvent.findMany({ where: { organizationId: ORGA } })
    expect(evts.length).toBeGreaterThanOrEqual(1)
    expect(evts.map((e) => e.kind)).toContain("GENERATED")
  })
  it("org B ne sme dostopati do arhivov org A (IDOR)", async () => {
    const inv = await mk("INVOICE", 60)
    const r = await generateEinvoice(inv, "ESLOG_2" as EInvoiceFormat)
    expect(r.ok).toBe(true)
    const list = await listEinvoices()
    expect(list.length).toBeGreaterThanOrEqual(1)
    // Med org vsebuje violent drug najemnik; enačen dan sam emulate: on pulje z
    // session takšnega org, ki nima tega org-ID → download mora vrniti null.
    const rowId = list[0].id
    const before = await downloadEinvoice(rowId)
    expect(before).not.toBeNull()
    // Tuji najemnik (org B) sme imeti veljaven session, ampak row iz org A
    // se mu NE sme izdati (download → null).
    state.session = { user: { id: ADMB, role: "ADMIN", organizationId: ORGB, email: "b@f.test" } }
    const bAfter = await downloadEinvoice(rowId)
    expect(bAfter).toBeNull()
    state.session = { user: { id: ADMA, role: "ADMIN", organizationId: ORGA, email: "a@f.test" } }
  })
  it("zamrzovanje: sprememba kupca po izdaji NE spremeni izdanega e-računa", async () => {
    // Kupca tipa — izdamo dokument, generiramo e-račun, nato spremenimo žive
    // kupčeve podatke → XML ostane enak (naziv/naslov iz SNAPSHOTA, ne živi).
    const inv = await mk("INVOICE", 80)
    const r1 = await generateEinvoice(inv, "UBL21_PEPPOL_3" as EInvoiceFormat)
    const dl1 = await downloadEinvoice(r1.id!)
    // Spremeni živo stranko (naslov + DDV bi se v snapshotu ne smel spreminjati).
    await prisma.customer.update({ where: { id: CUST }, data: { legalName: "POVSEM DRUGA", vatId: "SI99999999", street: "Drugkraj 99" } })
    // Ponovni generate idempotentno vrne ISTI original (arhiv write-once) —
    // novih DOCUMENT datumov ni; a arhiv je nespremenljiv.
    const r2 = await generateEinvoice(inv, "UBL21_PEPPOL_3" as EInvoiceFormat)
    const dl2 = await downloadEinvoice(r2.id!)
    expect(r2.alreadyExists).toBe(true)
    expect(dl2!.xml).toBe(dl1!.xml)
    expect(dl2!.xml).toContain("Ana Novak s.p.") // iz snapshota, ne žive vrednosti
    expect(dl2!.xml).toContain("SI87654321")
    expect(dl2!.xml).not.toContain("POVSEM DRUGA")
    // Povrni kupca (za cleaned druge teste).
    await prisma.customer.update({ where: { id: CUST }, data: { legalName: "Ana Novak s.p.", vatId: "SI87654321", street: "Trg 1" } })
  })
})

describe("F5.5.4.6.4 — oddaja e-računa (submitEinvoice)", () => {
  async function seedDirectChannel() {
    await (prisma as any).eInvoiceChannelConfig.deleteMany({ where: { organizationId: ORGA, channel: "direct" } }).catch(() => {})
    await (prisma as any).eInvoiceChannelConfig.create({
      data: {
        organizationId: ORGA,
        channel: "direct",
        label: "Partner proxy",
        status: "ENABLED",
        providerEndpoint: "https://provider.example/api/submit",
        config: {},
        encryptedSecret: "",
      },
    })
  }

  it("2xx → STATUS SUBMITTED (tehnično sprejeto), NE DELIVERY_ACK (šele čaka potrditev)", async () => {
    // DirectHttpProvider: HTTP 202 = tehnično sprejeto (technicalOnly). To NIKAKOR
    // ni potrditev dostave — po F5.5.4.6.4 se loči SUBMITTED od DELIVERED, in
    // DELIVERY_ACK se zabeleži ŠELE ob resnični potrditvi dostave (webhook/poll).
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response("submitted", { status: 202, headers: { "x-provider-message-id": "pm-1" } }) as Response
    ))
    const inv = await mk("INVOICE", 100)
    const gen = await generateEinvoice(inv, "UBL21_PEPPOL_3" as EInvoiceFormat)
    expect(gen.ok).toBe(true)
    await seedDirectChannel()

    const res = await submitEinvoice(gen.id!, "direct")
    expect(res.ok).toBe(true)
    expect(res.state).toBe("SUBMITTED")

    const row = await prisma.eInvoice.findUnique({ where: { id: gen.id! } })
    expect(row!.status).toBe("SUBMITTED")

    const evts = await prisma.eInvoiceDeliveryEvent.findMany({
      where: { einvoiceId: gen.id!, organizationId: ORGA },
    })
    expect(evts.map((e) => e.kind)).toContain("SUBMITTED")

    const rcpts = await prisma.eInvoiceReceipt.findMany({
      where: { einvoiceId: gen.id!, organizationId: ORGA },
      orderBy: { receivedAt: "desc" },
    })
    // Ključno: 2xx NI delivery ack. Premalo je, da se status postavi na
    // "poslano" — dokler ponudnik ni potrdil dejanske dostave, ostane SUBMITTED.
    expect(rcpts[0].kind).toBe("SUBMITTED")
    expect(rcpts[0].status).toBe("SUBMITTED")
  })

  it("idempotenca: ponovni submit istega e-računa ne pošlje znova", async () => {
    // P1/#1318: Direct pošilja prek injektabilnega _directTransport (z mock DNS),
    // zato štejemo transportne klice, ne fetch.
    const spy = vi.fn(async () => ({ status: 202, headers: { "x-provider-message-id": "idem-1" }, body: "ok" }))
    __setDirectTransportForTests(spy as any)
    const inv = await mk("INVOICE", 60)
    const gen = await generateEinvoice(inv, "ESLOG_2" as EInvoiceFormat)
    await seedDirectChannel()

    const first = await submitEinvoice(gen.id!, "direct")
    expect(first.ok).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)

    const second = await submitEinvoice(gen.id!, "direct")
    expect(second.ok).toBe(true)
    expect(second.alreadySubmitted).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1) // ni novega omrežnega klica
  })

  it("brez providerEndpoint → FAILED z CHANNEL_NOT_READY, brez omrežja", async () => {
    const spy = vi.fn()
    vi.stubGlobal("fetch", spy)
    const inv = await mk("INVOICE", 40)
    const gen = await generateEinvoice(inv, "UBL21_PEPPOL_3" as EInvoiceFormat)
    // Najprej izbrišemo morebitni obstoječ 'direct' kanal (unique org+channel),
    // nato ustvarimo brezpotne tistega, da submit pade v CHANNEL_NOT_READY.
    await (prisma as any).eInvoiceChannelConfig.deleteMany({ where: { organizationId: ORGA, channel: "direct" } }).catch(() => {})
    await (prisma as any).eInvoiceChannelConfig.create({
      data: {
        organizationId: ORGA,
        channel: "direct",
        label: "brez poti",
        status: "ENABLED",
        providerEndpoint: null,
        config: {},
        encryptedSecret: "",
      },
    })

    const res = await submitEinvoice(gen.id!, "direct")
    expect(res.ok).toBe(false)
    expect(res.error).toContain("CHANNEL_NOT_READY")
    expect(spy).not.toHaveBeenCalled()
    const row = await prisma.eInvoice.findUnique({ where: { id: gen.id! } })
    expect(row!.status).toBe("FAILED")
  })

  it("5xx → FAILED po retrijih", async () => {
    // P1/#1318: Direct pošilja prek injektabilnega _directTransport, ne fetch.
    const spy = vi.fn(async () => ({ status: 500, headers: {}, body: "server error" }))
    __setDirectTransportForTests(spy as any)
    await seedDirectChannel()
    const inv = await mk("INVOICE", 30)
    const gen = await generateEinvoice(inv, "UBL21_PEPPOL_3" as EInvoiceFormat)
    const res = await submitEinvoice(gen.id!, "direct")
    expect(res.ok).toBe(false)
    expect(res.error).toContain("HTTP 500")
    expect(spy).toHaveBeenCalledTimes(3) // 1 + retryja
    const row = await prisma.eInvoice.findUnique({ where: { id: gen.id! } })
    expect(row!.status).toBe("FAILED")
  })
})

describe("F5.5.4.6.4 / Faza 3.2 — dostavna zanka (poll)", () => {
  async function seedChannel(): Promise<void> {
    await (prisma as any).eInvoiceChannelConfig.deleteMany({ where: { organizationId: ORGA, channel: "direct" } }).catch(() => {})
    await (prisma as any).eInvoiceChannelConfig.create({
      data: {
        organizationId: ORGA,
        channel: "direct",
        label: "Partner proxy",
        status: "ENABLED",
        providerEndpoint: "https://provider.example/api/submit",
        config: {},
        encryptedSecret: "",
      },
    })
  }

  /** Ustvari SUBMITTED e-račun z znanim providerMessageId + channel=direct (neposredno v bazi). */
  async function makeSubmitted(): Promise<string> {
    await seedChannel()
    const docId = await mk("INVOICE", 50)
    const inv = await prisma.eInvoice.create({
      data: {
        organizationId: ORGA,
        documentId: docId,
        kind: "INVOICE",
        format: "UBL21_PEPPOL_3",
        docCode: "RAC-DELIV/2026",
        xml: Buffer.from("<Invoice/>").toString("base64"),
        sha256: "sha-" + Math.random().toString(36).slice(2),
        size: 32,
        xmlValidatedXsd: true,
        xmlValidatedBusiness: true,
        standardVersion: "PEPPOL-BIS-3.0.21",
        validatorVersion: "UBL-2.1",
        status: "SUBMITTED",
        providerMessageId: "pm-deliv-1",
        channel: "direct",
      },
    })
    return inv.id
  }

  it("SUBMITTED → DELIVERED z EInvoiceDeliveryEvent + DELIVERY_ACK receipt", async () => {
    const id = await makeSubmitted()
    __setDirectStatusForTests(async () => ({
      state: "DELIVERED",
      providerStatus: "delivered",
      timestamp: new Date().toISOString(),
      message: null,
    }))

    const res = await pollPendingDeliveriesForOrg(ORGA)
    expect(res.polled).toBeGreaterThanOrEqual(1)
    expect(res.transitioned).toBe(1)

    const row = await prisma.eInvoice.findUnique({ where: { id } })
    expect(row?.status).toBe("DELIVERED")

    const ev = await prisma.eInvoiceDeliveryEvent.findFirst({ where: { einvoiceId: id, kind: "DELIVERED" } })
    expect(ev).toBeTruthy()
    const rcpt = await prisma.eInvoiceReceipt.findFirst({ where: { einvoiceId: id, kind: "DELIVERY_ACK" } })
    expect(rcpt?.status).toBe("DELIVERED")
  })

  it("idempotentno: ponovni poll terminalnega stanja ne podvoji evidence", async () => {
    const id = await makeSubmitted()
    __setDirectStatusForTests(async () => ({
      state: "DELIVERED",
      providerStatus: "delivered",
      timestamp: new Date().toISOString(),
      message: null,
    }))
    await pollPendingDeliveriesForOrg(ORGA)
    const first = await prisma.eInvoiceDeliveryEvent.count({ where: { einvoiceId: id, kind: "DELIVERED" } })
    await pollPendingDeliveriesForOrg(ORGA)
    const second = await prisma.eInvoiceDeliveryEvent.count({ where: { einvoiceId: id, kind: "DELIVERED" } })
    expect(first).toBe(1)
    expect(second).toBe(1)
  })

  it("SUBMITTED → REJECTED (vsebinska zavrnitev ponudnika)", async () => {
    const id = await makeSubmitted()
    __setDirectStatusForTests(async () => ({
      state: "REJECTED",
      providerStatus: "rejected",
      timestamp: new Date().toISOString(),
      message: "NAJ-SPEC ref error",
    }))
    await pollPendingDeliveriesForOrg(ORGA)
    const row = await prisma.eInvoice.findUnique({ where: { id } })
    expect(row?.status).toBe("REJECTED")
    expect(await prisma.eInvoiceReceipt.findFirst({ where: { einvoiceId: id, kind: "REJECTION" } })).toBeTruthy()
  })

  it("A10: začasna napaka polla → ostane SUBMITTED; šele po izčrpanih poskusih FAILED", async () => {
    const id = await makeSubmitted()
    __setDirectStatusForTests(async () => {
      throw new Error("network timeout")
    })
    // prvi začasni neuspeh: poveča deliveryAttempts, ostane SUBMITTED
    await pollPendingDeliveriesForOrg(ORGA)
    let row = await prisma.eInvoice.findUnique({ where: { id } })
    expect(row?.status).toBe("SUBMITTED")
    expect(row?.deliveryAttempts).toBe(1)

    // POŠTENA ROTACIJA (TOČKA 4): vsak poskus je časovno razmaknjen (nextPollAt
    // v prihodnosti), zato simuliraj naslednji cron tick, da račun postane znova
    // primeren — v produkciji je to preprosto naslednji tick (backoff odložen).
    await prisma.eInvoice.update({ where: { id }, data: { nextPollAt: new Date(Date.now() - 1000) } })
    await pollPendingDeliveriesForOrg(ORGA)
    row = await prisma.eInvoice.findUnique({ where: { id } })
    expect(row?.status).toBe("SUBMITTED")
    expect(row?.deliveryAttempts).toBe(2)
    expect(await prisma.eInvoiceReceipt.findFirst({ where: { einvoiceId: id, kind: "FAILURE" } })).toBeNull()

    // izčrpani poskusi (MAX_DELIVERY_ATTEMPTS) → dokončni FAILED + FAILURE receipt
    await prisma.eInvoice.update({ where: { id }, data: { nextPollAt: new Date(Date.now() - 1000) } })
    await pollPendingDeliveriesForOrg(ORGA)
    row = await prisma.eInvoice.findUnique({ where: { id } })
    expect(row?.status).toBe("FAILED")
    expect(await prisma.eInvoiceReceipt.findFirst({ where: { einvoiceId: id, kind: "FAILURE" } })).toBeTruthy()
  })

  it("A7: sistemski globalni poller (cron) prevede SUBMITTED → DELIVERED", async () => {
    const id = await makeSubmitted()
    __setDirectStatusForTests(async () => ({
      state: "DELIVERED",
      providerStatus: "delivered",
      timestamp: new Date().toISOString(),
      message: null,
    }))
    const res = await pollPendingDeliveries()
    expect(res.transitioned).toBeGreaterThanOrEqual(1)
    expect((await prisma.eInvoice.findUnique({ where: { id } }))?.status).toBe("DELIVERED")
  })

  it("A7: org polling ORGA ne sme prevesti pošiljke druge organizacije (ORGB)", async () => {
    // ORGA pošiljka → DELIVERED
    const idA = await makeSubmitted()
    // ORGB pošiljka → z lastnim kanalom (v ORGB) in status override DELIVERED.
    await (prisma as any).eInvoiceChannelConfig.deleteMany({ where: { organizationId: ORGB, channel: "direct" } }).catch(() => {})
    await (prisma as any).eInvoiceChannelConfig.create({
      data: {
        organizationId: ORGB,
        channel: "direct",
        label: "Partner proxy",
        status: "ENABLED",
        providerEndpoint: "https://provider.example/api/submit",
        config: {},
        encryptedSecret: "",
      },
    })
    // Dokument ustvarimo pod ORGA (mk uporablja trenutno ORGA sejo) — naslednje
    // seje `beforeEach` obrišejo ORGA dokumente, zato ORGB Invoice spodaj na koncu
    // testa IZRECNO obrišemo, da ne blokira FK-ja za ORGA dokumente.
    const docB = await mk("INVOICE", 51)
    const idB = (await prisma.eInvoice.create({
      data: {
        organizationId: ORGB,
        documentId: docB,
        kind: "INVOICE",
        format: "UBL21_PEPPOL_3",
        docCode: "RAC-B/2026",
        xml: Buffer.from("<Invoice/>").toString("base64"),
        sha256: "sha-" + Math.random().toString(36).slice(2),
        size: 32,
        xmlValidatedXsd: true,
        xmlValidatedBusiness: true,
        standardVersion: "PEPPOL-BIS-3.0.21",
        validatorVersion: "UBL-2.1",
        status: "SUBMITTED",
        providerMessageId: "pm-orgb-isolated",
        channel: "direct",
      },
    })).id
    __setDirectStatusForTests(async () => ({
      state: "DELIVERED",
      providerStatus: "delivered",
      timestamp: new Date().toISOString(),
      message: null,
    }))

    // solo polling org A: ORGA napreduje, ORGB ostane SUBMITTED
    const res = await pollPendingDeliveriesForOrg(ORGA)
    expect((await prisma.eInvoice.findUnique({ where: { id: idA } }))?.status).toBe("DELIVERED")
    expect((await prisma.eInvoice.findUnique({ where: { id: idB } }))?.status).toBe("SUBMITTED")
    expect(res.transitioned).toBeGreaterThanOrEqual(1)

    // Pospravi ORGB pošiljko + njen ORGA dokument, da naslednja `beforeEach`
    // (ki čisti ORGA e-račune in dokumente) ne zadane FK (EInvoice → document)
    // prek tega čez-org referenčnega para.
    await prisma.eInvoiceReceipt.deleteMany({ where: { einvoiceId: idB } })
    await prisma.eInvoiceDeliveryEvent.deleteMany({ where: { einvoiceId: idB } })
    await prisma.eInvoice.delete({ where: { id: idB } })
    await prisma.document.delete({ where: { id: docB } }).catch(() => {})
  })
})

describe("F5.5.4.6.4 / Faza 3.2 — povratni webhook", () => {
  it("neznana pošiljka / ne-veljaven podpis → ok:false, brez učinka", async () => {
    // TOČKA 2 — organizacija mora biti prisotna in kriptografsko potrjena.
    // V tem bloku ORGA nima nastavljenega DIRECT kanala/skrivnosti, zato
    // `channelCfgFor` vrne cfg brez `webhookSecret` → `verifyWebhook` je
    // fail-closed („invalid signature") PREDEN sploh poizvedujemo po računu.
    // S tem ne razkrijemo obstoja računa brez veljavnega podpisa.
    const res = await recordDeliveryFromWebhook({
      organizationId: ORGA,
      channel: "direct",
      providerMessageId: "pm-neobstoječi",
      status: "DELIVERED",
      signature: "sha256=spoof",
      timestamp: new Date().toISOString(),
      rawBody: '{"organizationId":"' + ORGA + '","channel":"direct","providerMessageId":"pm-neobstoječi","status":"DELIVERED"}',
    })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("invalid signature")
  })
})

describe("F5.5.4.6.4 / Faza 3.2 — povratni webhook (legitimni)", () => {
  /** Ustvari SUBMITTED e-račun na kanalu 'direct' s kanalno skrivnostjo. */
  async function makeSubmitted(): Promise<string> {
    await (prisma as any).eInvoiceChannelConfig.deleteMany({ where: { organizationId: ORGA, channel: "direct" } }).catch(() => {})
    await (prisma as any).eInvoiceChannelConfig.create({
      data: {
        organizationId: ORGA,
        channel: "direct",
        label: "Partner proxy",
        status: "ENABLED",
        providerEndpoint: "https://provider.example/api/submit",
        config: {},
        // A3 — webhook skrivnost kanala, shranjena ŠIFRIRANO (AES-256-GCM)
        // prek `encryptSecret` modula `einvoice/secrets` kot JSON-vrednost.
        encryptedSecret: encryptSecret(JSON.stringify({ webhookSecret: WEBHOOK_SECRET })),
      },
    })
    const docId = await mk("INVOICE", 40)
    const inv = await prisma.eInvoice.create({
      data: {
        organizationId: ORGA,
        documentId: docId,
        kind: "INVOICE",
        format: "UBL21_PEPPOL_3",
        docCode: "RAC-WEB/2026",
        xml: Buffer.from("<Invoice/>").toString("base64"),
        sha256: "sha-" + Math.random().toString(36).slice(2),
        size: 32,
        xmlValidatedXsd: true,
        xmlValidatedBusiness: true,
        standardVersion: "PEPPOL-BIS-3.0.21",
        validatorVersion: "UBL-2.1",
        status: "SUBMITTED",
        providerMessageId: "pm-web-1",
        channel: "direct",
      },
    })
    return inv.id
  }

  /** Sestavi veljavno, HMAC-podpisano webhook pošiljko (A3/A5). `organizationId`
   *  je del telesa in podpisa (TOČKA 2): uporablja se kot usmerjevalnik na
   *  skrivnost org+kanal; veljaven HMAC s to skrivnostjo kriptografsko potrdi
   *  pripadnost in se pred poizvedbo po računu preveri. */
  function signedWebhook(overrides: { status?: "DELIVERED" | "REJECTED"; providerMessageId?: string; sigPrefix?: string; organizationId?: string } = {}) {
    const body = {
      organizationId: overrides.organizationId ?? ORGA,
      channel: "direct",
      providerMessageId: overrides.providerMessageId ?? "pm-web-1",
      status: overrides.status ?? "DELIVERED",
    }
    const rawBody = JSON.stringify(body)
    const timestamp = new Date().toISOString()
    const signature = (overrides.sigPrefix ?? "sha256=") + signWebhookHmac(WEBHOOK_SECRET, rawBody, timestamp)
    return { ...body, rawBody, timestamp, signature }
  }

  it("legitimni webhook (veljaven HMAC) → DELIVERED", async () => {
    const id = await makeSubmitted()
    const w = signedWebhook()
    const res = await recordDeliveryFromWebhook({ ...w, channel: "direct", status: "DELIVERED" })
    expect(res.ok).toBe(true)
    expect(res.changed).toBe(true)
    const row = await prisma.eInvoice.findUnique({ where: { id } })
    expect(row?.status).toBe("DELIVERED")
    expect(await prisma.eInvoiceDeliveryEvent.findFirst({ where: { einvoiceId: id, kind: "DELIVERED" } })).toBeTruthy()
  })

  it("webhook s ponarejenim podpisom → zavrnjen, brez učinka (fail-closed)", async () => {
    const id = await makeSubmitted()
    const w = signedWebhook({ sigPrefix: "sha256=" })
    const forged = { ...w, signature: "sha256=" + "0".repeat(64) }
    const res = await recordDeliveryFromWebhook(forged)
    expect(res.ok).toBe(false)
    expect(res.error).toBe("invalid signature")
    const row = await prisma.eInvoice.findUnique({ where: { id } })
    expect(row?.status).toBe("SUBMITTED") // ni spremenjeno
  })

  it("webhook z neveljavnim časom (timestamp predaleč nazaj) → zavrnjen", async () => {
    await makeSubmitted()
    const w = signedWebhook()
    const stale = { ...w, timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() }
    // ponovno podpišemo z istim (starim) timestampom — podpis je "veljaven",
    // a paket zavrnemo zaradi replay zaščite
    stale.signature = "sha256=" + signWebhookHmac(WEBHOOK_SECRET, stale.rawBody, stale.timestamp)
    const res = await recordDeliveryFromWebhook(stale)
    expect(res.ok).toBe(false)
    expect(res.error).toBe("invalid signature")
  })

  it("že zaključen e-račun → changed:false (idempotentno)", async () => {
    const id = await makeSubmitted()
    const w = signedWebhook()
    await recordDeliveryFromWebhook({ ...w, channel: "direct", status: "DELIVERED" })
    const again = await recordDeliveryFromWebhook({ ...signedWebhook(), channel: "direct", status: "DELIVERED" })
    expect(again.changed).toBe(false)
    expect(await prisma.eInvoiceDeliveryEvent.count({ where: { einvoiceId: id, kind: "DELIVERED" } })).toBe(1)
  })
})

describe("F5.5.4.6.4 / Faza 3.2 — TOČKA 2: tenant izolacija povratnega webhooka", () => {
  it("webhook s pravilno ORGA skrivnostjo, a organizationId=ORGB v telesu → ne spremeni ORGA računa", async () => {
    // makeSubmitted iz sosednjega describe bloka ni v tem scope-u, zato račun
    // ORGA ustvarimo neposredno (isti vzorec kot makeSubmitted).
    await (prisma as any).eInvoiceChannelConfig.deleteMany({ where: { organizationId: ORGA, channel: "direct" } }).catch(() => {})
    await (prisma as any).eInvoiceChannelConfig.create({
      data: {
        organizationId: ORGA,
        channel: "direct",
        label: "Partner proxy",
        status: "ENABLED",
        providerEndpoint: "https://provider.example/api/submit",
        config: {},
        encryptedSecret: encryptSecret(JSON.stringify({ webhookSecret: WEBHOOK_SECRET })),
      },
    })
    const docId = await mk("INVOICE", 40)
    const inv = await prisma.eInvoice.create({
      data: {
        organizationId: ORGA,
        documentId: docId,
        kind: "INVOICE",
        format: "UBL21_PEPPOL_3",
        docCode: "RAC-TEN/2026",
        xml: Buffer.from("<Invoice/>").toString("base64"),
        sha256: "sha-" + Math.random().toString(36).slice(2),
        size: 32,
        xmlValidatedXsd: true,
        xmlValidatedBusiness: true,
        standardVersion: "PEPPOL-BIS-3.0.21",
        validatorVersion: "UBL-2.1",
        status: "SUBMITTED",
        providerMessageId: "pm-web-1",
        channel: "direct",
      },
    })

    // Napadalec pozna ORGA skrivnost (to je bil njegov org kanal), a v telesu
    // navaja ORGB + veljaven HMAC z lastno skrivnostjo. Podpisan je s skrivnostjo,
    // ki NIKOLI ni skrivnost računa (pm-web-1 → ORGA). Podpis mora biti vezan na
    // org+kanal računa; če bi upoštevali zgolj organizacijo iz telesa, bi lahko
    // usmeril na račun druge org. TOČKA 2 zahteva, da se kanal izpelje iz
    // skrivnosti (fail-closed, če se ne ujema).
    const forgedBody = JSON.stringify({ organizationId: ORGB, channel: "direct", providerMessageId: "pm-web-1", status: "DELIVERED" })
    const ts = new Date().toISOString()
    const res = await recordDeliveryFromWebhook({
      organizationId: ORGB,
      channel: "direct",
      providerMessageId: "pm-web-1",
      status: "DELIVERED",
      signature: "sha256=" + signWebhookHmac(WEBHOOK_SECRET, forgedBody, ts),
      timestamp: ts,
      rawBody: forgedBody,
    })
    expect(res.ok).toBe(false)
    const row = await prisma.eInvoice.findUnique({ where: { id: inv.id } })
    expect(row?.status).toBe("SUBMITTED") // ORGA račun ni spremenjen
  })
})