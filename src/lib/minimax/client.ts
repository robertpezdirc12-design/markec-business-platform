// ============================================================
// MINIMAX API CLIENT (Slovenija — računovodstvo)
//
// RESTful API za izmenjavo podatkov z Minimax računovodskim
// programom: stranke, artikli, izdani računi, zaloge, knjižbe.
//
// Avtentikacija: OAuth2 (grant_type=password), token velja 3600s.
// Omejitve: 1.000 klicev/dan, 20.000/mesec, 1.000 računov/mesec.
//
// Dokumentacija: https://moj.minimax.si/SI/API
// ============================================================

/** Konfiguracija za povezavo z Minimax (shranjena na Organization). */
export interface MinimaxConfig {
  /** OAuth2 client_id (iz Minimax aplikacije). */
  clientId: string
  /** OAuth2 client_secret. */
  clientSecret: string
  /** Uporabniško ime za API (nastavljeno ob ustvarjanju aplikacije). */
  username: string
  /** Geslo za API. */
  password: string
  /** ID organizacije v Minimax (različen od MARKEC org ID). */
  organisationId: number
  /** API base URL (privzeto slovenski). */
  apiBaseUrl?: string
  /** Auth URL (privzeto slovenski). */
  authUrl?: string
}

const DEFAULT_API_BASE = "https://moj.minimax.si/SI/API"
const DEFAULT_AUTH_URL = "https://moj.minimax.si/SI/AUT/oauth20/token"

/** Minimax API error response. */
export interface MinimaxError {
  ErrorCode: number
  ErrorMessage: string
  /** Podrobnejši opis napake (validacija itd.). */
  ErrorDetails?: string
}

/** Rezultat API klica — diskriminiran union za tipno varnost. */
export type MinimaxResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: MinimaxError }

// ── OAuth2 token management ──────────────────────────────────

interface TokenCache {
  accessToken: string
  expiresAt: number
}

// Per-config cache (key = clientId:organisationId). Token velja 1h.
const tokenCache = new Map<string, TokenCache>()

function cacheKey(cfg: MinimaxConfig): string {
  return `${cfg.clientId}:${cfg.organisationId}`
}

/**
 * Pridobi OAuth2 access token (password grant).
 * Token se predpomni do 5 minut pred potekom.
 */
export async function getMinimaxToken(
  cfg: MinimaxConfig
): Promise<MinimaxResult<string>> {
  const key = cacheKey(cfg)
  const cached = tokenCache.get(key)
  if (cached && cached.expiresAt > Date.now() + 5 * 60_000) {
    return { ok: true, data: cached.accessToken }
  }

  const authUrl = cfg.authUrl ?? DEFAULT_AUTH_URL
  try {
    const res = await fetch(authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        grant_type: "password",
        username: cfg.username,
        password: cfg.password,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      return {
        ok: false,
        error: {
          ErrorCode: res.status,
          ErrorMessage: `Avtentikacija ni uspela (${res.status})`,
          ErrorDetails: body.slice(0, 500),
        },
      }
    }

    const json = (await res.json()) as { access_token: string; expires_in?: number }
    const ttl = (json.expires_in ?? 3600) * 1000
    tokenCache.set(key, {
      accessToken: json.access_token,
      expiresAt: Date.now() + ttl,
    })
    return { ok: true, data: json.access_token }
  } catch (err) {
    return {
      ok: false,
      error: {
        ErrorCode: 0,
        ErrorMessage: "Omrežna napaka pri avtentikaciji",
        ErrorDetails: String(err).slice(0, 500),
      },
    }
  }
}

/** Počisti predpomnjen token (npr. ob 401). */
export function invalidateMinimaxToken(cfg: MinimaxConfig): void {
  tokenCache.delete(cacheKey(cfg))
}

// ── Generic HTTP helper ──────────────────────────────────────

async function minimaxFetch<T>(
  cfg: MinimaxConfig,
  method: string,
  path: string,
  body?: unknown
): Promise<MinimaxResult<T>> {
  const tokenResult = await getMinimaxToken(cfg)
  if (!tokenResult.ok) return tokenResult

  const base = cfg.apiBaseUrl ?? DEFAULT_API_BASE
  const url = `${base}/api/orgs/${cfg.organisationId}${path}`

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${tokenResult.data}`,
        "Content-Type": "application/json",
      },
      body: body != null ? JSON.stringify(body) : undefined,
    })

    // 401 → token je potekel, počistimo in povemo klicatelju
    if (res.status === 401) {
      invalidateMinimaxToken(cfg)
      return {
        ok: false,
        error: {
          ErrorCode: 401,
          ErrorMessage: "Token je potekel — poskusite ponovno",
        },
      }
    }

    const json = await res.json().catch(() => null)

    if (!res.ok) {
      return {
        ok: false,
        error: {
          ErrorCode: res.status,
          ErrorMessage:
            (json as MinimaxError)?.ErrorMessage ?? `Napaka ${res.status}`,
          ErrorDetails: (json as MinimaxError)?.ErrorDetails,
        },
      }
    }

    return { ok: true, data: json as T }
  } catch (err) {
    return {
      ok: false,
      error: {
        ErrorCode: 0,
        ErrorMessage: "Omrežna napaka",
        ErrorDetails: String(err).slice(0, 500),
      },
    }
  }
}

// ── Customers ────────────────────────────────────────────────

export interface MinimaxCustomer {
  ID?: number
  Name: string
  TaxNumber?: string
  /** Davčna številka zavezanci (SI). */
  VatNumber?: string
  Street?: string
  PostNumber?: string
  City?: string
  Country?: string
  Email?: string
  Phone?: string
  /** 1 = fizična oseba, 2 = pravna oseba. */
  CustomerType?: 1 | 2
}

/** Ustvari stranko v Minimax. */
export async function addMinimaxCustomer(
  cfg: MinimaxConfig,
  customer: MinimaxCustomer
): Promise<MinimaxResult<{ ID: number }>> {
  return minimaxFetch(cfg, "POST", "/customers", customer)
}

/** Poišči stranko po imenu ali davčni številki. */
export async function findMinimaxCustomer(
  cfg: MinimaxConfig,
  query: { name?: string; vatNumber?: string }
): Promise<MinimaxResult<MinimaxCustomer[]>> {
  const params = new URLSearchParams()
  if (query.name) params.set("name", query.name)
  if (query.vatNumber) params.set("vatNumber", query.vatNumber)
  return minimaxFetch(cfg, "GET", `/customers?${params}`)
}

// ── Issued Invoices ──────────────────────────────────────────

export interface MinimaxInvoiceRow {
  RowNumber: number
  /** ID artikla v Minimax (ali Service za storitve). */
  Item?: { ID: number }
  /** Opis (če ni artikla). */
  Description?: string
  Quantity: number
  UnitOfMeasurement?: string
  Price: number
  /** ID DDV stopnje v Minimax. */
  VatRate?: { ID: number }
  VATPercent?: number
  DiscountPercent?: number
}

export interface MinimaxPaymentMethod {
  PaymentMethod: { ID: number }
  Amount: number
  AlreadyPaid: "Y" | "N"
}

export interface MinimaxInvoice {
  ID?: number
  /** R = gotovinski račun, N = negotovinski. */
  InvoiceType: "R" | "N"
  Customer: { ID: number }
  /** Številčenje dokumentov (za davčno potrjevanje). */
  DocumentNumbering?: { ID: number }
  /** Blagajnik (za davčno potrjevanje). */
  Employee?: { ID: number }
  DateIssued: string
  DateTransaction: string
  DateDue: string
  ReferenceNumber?: string
  /** Sklic / plačilni rok. */
  PaymentDueDate?: string
  Notes?: string
  IssuedInvoiceRows: MinimaxInvoiceRow[]
  IssuedInvoicePaymentMethods?: MinimaxPaymentMethod[]
}

/** Ustvari izdani račun v Minimax. */
export async function addMinimaxInvoice(
  cfg: MinimaxConfig,
  invoice: MinimaxInvoice
): Promise<MinimaxResult<{ ID: number }>> {
  return minimaxFetch(cfg, "POST", "/issuedinvoices", invoice)
}

/** Pridobi izdani račun. */
export async function getMinimaxInvoice(
  cfg: MinimaxConfig,
  invoiceId: number
): Promise<MinimaxResult<MinimaxInvoice>> {
  return minimaxFetch(cfg, "GET", `/issuedinvoices/${invoiceId}`)
}

/** Pridobi vse izdane račune (za sinhronizacijo). */
export async function getMinimaxInvoices(
  cfg: MinimaxConfig,
  options?: { dateFrom?: string; dateTo?: string }
): Promise<MinimaxResult<MinimaxInvoice[]>> {
  const params = new URLSearchParams()
  if (options?.dateFrom) params.set("dateFrom", options.dateFrom)
  if (options?.dateTo) params.set("dateTo", options.dateTo)
  return minimaxFetch(cfg, "GET", `/issuedinvoices?${params}`)
}

/**
 * Akcije na izdanem računu:
 *   issue                  — izdaj račun (davčno potrdi, če je gotovinski)
 *   issueCancellation      — storniraj
 *   generatepdf            — generiraj PDF
 *   copytocreditnote       — kopiraj v dobropis
 *   copyToReverse          — kopiraj v obratni račun
 *   issueAndGeneratepdf    — izdaj + PDF
 *   sendEInvoice           — pošlji eRačun
 */
export type MinimaxInvoiceAction =
  | "issue"
  | "issueCancellation"
  | "generatepdf"
  | "copytocreditnote"
  | "copyToReverse"
  | "issueAndGeneratepdf"
  | "sendEInvoice"

/** Izvedi akcijo na računu (issue, PDF, eRačun …). */
export async function minimaxInvoiceAction(
  cfg: MinimaxConfig,
  invoiceId: number,
  action: MinimaxInvoiceAction,
  options?: { issueCancellationReason?: string; reverseReason?: string }
): Promise<MinimaxResult<{ success: boolean }>> {
  return minimaxFetch(cfg, "POST", `/issuedinvoices/${invoiceId}/actions`, {
    actionName: action,
    ...options,
  })
}

// ── Payment Methods ──────────────────────────────────────────

export interface MinimaxPaymentMethodInfo {
  ID: number
  Name: string
}

/** Pridobi načine plačila organizacije. */
export async function getMinimaxPaymentMethods(
  cfg: MinimaxConfig
): Promise<MinimaxResult<MinimaxPaymentMethodInfo[]>> {
  return minimaxFetch(cfg, "GET", "/issuedinvoices/paymentmethods")
}

// ── VAT Rates ────────────────────────────────────────────────

export interface MinimaxVatRate {
  ID: number
  Name: string
  Percentage: number
  /** Osnovna (default) DDV stopnja. */
  IsDefault?: boolean
}

/** Pridobi DDV stopnje organizacije. */
export async function getMinimaxVatRates(
  cfg: MinimaxConfig
): Promise<MinimaxResult<MinimaxVatRate[]>> {
  return minimaxFetch(cfg, "GET", "/vatrates")
}

// ── Items (artikli/storitve) ─────────────────────────────────

export interface MinimaxItem {
  ID?: number
  Name: string
  /** Tip: Service (storitev) ali Product (izdelek). */
  ItemType?: "Service" | "Product"
  Code?: string
  UnitOfMeasurement?: string
  /** Privzeta cena. */
  Price?: number
  VatRate?: { ID: number }
  IsService?: boolean
}

/** Ustvari artikel/storitev v Minimax. */
export async function addMinimaxItem(
  cfg: MinimaxConfig,
  item: MinimaxItem
): Promise<MinimaxResult<{ ID: number }>> {
  return minimaxFetch(cfg, "POST", "/items", item)
}

/** Poišči artikel po imenu. */
export async function findMinimaxItem(
  cfg: MinimaxConfig,
  name: string
): Promise<MinimaxResult<MinimaxItem[]>> {
  return minimaxFetch(cfg, "GET", `/items?name=${encodeURIComponent(name)}`)
}

// ── Connection test ──────────────────────────────────────────

/** Preveri povezavo z Minimax (lahki klic). */
export async function testMinimaxConnection(
  cfg: MinimaxConfig
): Promise<MinimaxResult<{ connected: boolean; organisationId: number }>> {
  const tokenResult = await getMinimaxToken(cfg)
  if (!tokenResult.ok) return tokenResult

  // Preverimo z lahkim klicem — payment methods je najmanj invaziven.
  const pm = await getMinimaxPaymentMethods(cfg)
  if (pm.ok) {
    return { ok: true, data: { connected: true, organisationId: cfg.organisationId } }
  }
  return pm
}
