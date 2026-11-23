"use server"

// #110 — Minimax računovodske akcije (server actions).
// Varnost: zahteva OWNER vlogo + org header. Gesla se NE vračajo
// nazaj v UI (samo boolean "ali je nastavljeno").

import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import {
  testMinimaxConnection,
  addMinimaxInvoice,
  addMinimaxCustomer,
  findMinimaxCustomer,
  minimaxInvoiceAction,
  type MinimaxConfig,
  type MinimaxInvoice,
  type MinimaxCustomer,
} from "@/lib/minimax/client"

// ── Helpers ──────────────────────────────────────────────────

async function requireOwner() {
  const session = await auth()
  if (!session?.user?.id) return { error: "unauthorized" as const }
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    if (!org) return { error: "no_org" as const }
    return { session, org }
  } catch {
    // P0 (M1, audit 2026-11): vloga OWNER ne obstaja (vloge so samo
    // ADMIN/STAFF/CLIENTE) — prejšnji `role !== "OWNER"` je ta vmesnik
    // trajno zaklenil (vedno "forbidden"). `settings.manage` je edini
    // avtoritativen prever; nepooblaščen dostop → "forbidden".
    return { error: "forbidden" as const }
  }
}

/** Sestavi MinimaxConfig iz baze. Če ni nastavljeno → null. */
async function loadMinimaxConfig(
  orgId: string
): Promise<MinimaxConfig | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      minimaxClientId: true,
      minimaxClientSecret: true,
      minimaxUsername: true,
      minimaxPassword: true,
      minimaxOrganisationId: true,
    },
  })
  if (
    !org?.minimaxClientId ||
    !org.minimaxClientSecret ||
    !org.minimaxUsername ||
    !org.minimaxPassword ||
    !org.minimaxOrganisationId
  ) {
    return null
  }
  return {
    clientId: org.minimaxClientId,
    clientSecret: org.minimaxClientSecret,
    username: org.minimaxUsername,
    password: org.minimaxPassword,
    organisationId: org.minimaxOrganisationId,
  }
}

// ── Settings ─────────────────────────────────────────────────

export interface MinimaxStatus {
  configured: boolean
  organisationId: number | null
  configuredAt: Date | null
}

/** Vrne stanje povezave (brez občutljivih podatkov). */
export async function getMinimaxStatus(): Promise<
  { error: string } | MinimaxStatus
> {
  const authResult = await requireOwner()
  if ("error" in authResult) return { error: authResult.error ?? "unauthorized" }

  const org = await prisma.organization.findUnique({
    where: { id: authResult.org.id },
    select: {
      minimaxClientId: true,
      minimaxOrganisationId: true,
      minimaxConfiguredAt: true,
    },
  })

  return {
    configured: Boolean(
      org?.minimaxClientId && org?.minimaxOrganisationId
    ),
    organisationId: org?.minimaxOrganisationId ?? null,
    configuredAt: org?.minimaxConfiguredAt ?? null,
  }
}

/** Shrani Minimax konfiguracijo. */
export async function saveMinimaxConfig(input: {
  clientId: string
  clientSecret: string
  username: string
  password: string
  organisationId: number
}): Promise<{ error?: string; ok?: boolean }> {
  const authResult = await requireOwner()
  if ("error" in authResult) return { error: authResult.error ?? "unauthorized" }

  // Validacija
  if (
    !input.clientId?.trim() ||
    !input.clientSecret?.trim() ||
    !input.username?.trim() ||
    !input.password?.trim() ||
    !input.organisationId
  ) {
    return { error: "Vsa polja so obvezna." }
  }

  await prisma.organization.update({
    where: { id: authResult.org.id },
    data: {
      minimaxClientId: input.clientId.trim(),
      minimaxClientSecret: input.clientSecret.trim(),
      minimaxUsername: input.username.trim(),
      minimaxPassword: input.password.trim(),
      minimaxOrganisationId: input.organisationId,
      minimaxConfiguredAt: new Date(),
    },
  })

  return { ok: true }
}

/** Prekini povezavo z Minimax (izbriši konfiguracijo). */
export async function disconnectMinimax(): Promise<{ error?: string; ok?: boolean }> {
  const authResult = await requireOwner()
  if ("error" in authResult) return { error: authResult.error ?? "unauthorized" }

  await prisma.organization.update({
    where: { id: authResult.org.id },
    data: {
      minimaxClientId: null,
      minimaxClientSecret: null,
      minimaxUsername: null,
      minimaxPassword: null,
      minimaxOrganisationId: null,
      minimaxConfiguredAt: null,
    },
  })

  return { ok: true }
}

/** Testiraj povezavo z Minimax. */
export async function testMinimax(): Promise<
  { error: string } | { ok: true; message: string }
> {
  const authResult = await requireOwner()
  if ("error" in authResult) return { error: authResult.error ?? "unauthorized" }

  const cfg = await loadMinimaxConfig(authResult.org.id)
  if (!cfg) {
    return { error: "Minimax ni nastavljen. Najprej shranite konfiguracijo." }
  }

  const result = await testMinimaxConnection(cfg)
  if (!result.ok) {
    return {
      error: `Povezava ni uspela: ${result.error.ErrorMessage}${
        result.error.ErrorDetails ? ` (${result.error.ErrorDetails})` : ""
      }`,
    }
  }

  return {
    ok: true,
    message: `Povezava vzpostavljena! Organizacija ID: ${result.data.organisationId}`,
  }
}

// ── Invoice export ───────────────────────────────────────────

/**
 * Izvozi MARKEC dokument (INVOICE/CREDIT) v Minimax.
 * - Ustvari stranko, če še ne obstaja (po davčni številki/imenu).
 * - Ustvari račun z vrsticami.
 * - Opcijsko izda račun (davčno potrdi).
 */
export async function exportDocumentToMinimax(
  documentId: string,
  options?: { issue?: boolean }
): Promise<
  | { error: string }
  | { ok: true; minimaxInvoiceId: number; message: string }
> {
  const authResult = await requireOwner()
  if ("error" in authResult) return { error: authResult.error ?? "unauthorized" }

  const cfg = await loadMinimaxConfig(authResult.org.id)
  if (!cfg) {
    return { error: "Minimax ni nastavljen." }
  }

  // Naloži dokument iz MARKEC
  const doc = await prisma.document.findFirst({
    where: { id: documentId, organizationId: authResult.org.id },
    include: {
      items: { orderBy: { position: "asc" } },
      customer: true,
    },
  })
  if (!doc) return { error: "Dokument ni najden." }
  if (doc.type !== "INVOICE" && doc.type !== "CREDIT") {
    return { error: "V Minimax se izvažajo samo računi (INVOICE) in dobropisi (CREDIT)." }
  }

  // 1. Poišči / ustvari stranko
  let minimaxCustomerId: number
  if (doc.customer?.name) {
    const existing = await findMinimaxCustomer(cfg, {
      name: doc.customer.name,
      vatNumber: doc.customer.vatId ?? undefined,
    })
    if (existing.ok && existing.data.length > 0 && existing.data[0].ID) {
      minimaxCustomerId = existing.data[0].ID
    } else {
      const newCustomer: MinimaxCustomer = {
        Name: doc.customer.name,
        Email: doc.customer.email ?? undefined,
        Phone: doc.customer.phone ?? undefined,
        VatNumber: doc.customer.vatId ?? undefined,
      }
      const created = await addMinimaxCustomer(cfg, newCustomer)
      if (!created.ok) {
        return { error: `Napaka pri ustvarjanju stranke: ${created.error.ErrorMessage}` }
      }
      minimaxCustomerId = created.data.ID
    }
  } else {
    // Brez stranke — anonimni kupec
    const anon = await addMinimaxCustomer(cfg, { Name: "Kupec" })
    if (!anon.ok) {
      return { error: `Napaka: ${anon.error.ErrorMessage}` }
    }
    minimaxCustomerId = anon.data.ID
  }

  // 2. Sestavi račun
  const invoice: MinimaxInvoice = {
    InvoiceType: "N", // negotovinski (B2B/B2C brez gotovine)
    Customer: { ID: minimaxCustomerId },
    DateIssued: (doc.issueDate ?? doc.createdAt).toISOString().split("T")[0]!,
    DateTransaction: (doc.issueDate ?? doc.createdAt).toISOString().split("T")[0]!,
    DateDue: (
      doc.dueDate ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    ).toISOString().split("T")[0]!,
    Notes: doc.notes ?? undefined,
    IssuedInvoiceRows: doc.items.map((item, idx) => ({
      RowNumber: idx + 1,
      Description: item.description,
      Quantity: Number(item.quantity),
      UnitOfMeasurement: "kom",
      Price: Number(item.unitPrice),
      VATPercent: Number(item.vatRate ?? 0),
    })),
  }

  // 3. Pošlji v Minimax
  const result = await addMinimaxInvoice(cfg, invoice)
  if (!result.ok) {
    return { error: `Napaka pri izvozu računa: ${result.error.ErrorMessage}` }
  }

  const minimaxInvoiceId = result.data.ID

  // 4. Opcijsko izdaj (davčno potrdi)
  let message = `Račun izvožen v Minimax (ID: ${minimaxInvoiceId}).`
  if (options?.issue) {
    const issueResult = await minimaxInvoiceAction(cfg, minimaxInvoiceId, "issue")
    if (issueResult.ok) {
      message = `Račun izvožen in izdan v Minimax (ID: ${minimaxInvoiceId}).`
    } else {
      message = `Račun izvožen (ID: ${minimaxInvoiceId}), vendar izdaja ni uspela: ${issueResult.error.ErrorMessage}`
    }
  }

  // 5. Vrni rezultat
  return { ok: true, minimaxInvoiceId, message }
}
