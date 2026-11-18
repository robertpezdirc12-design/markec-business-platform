// ============================================================
// 46ELKS SMS CLIENT (Slovenija / Nordics)
//
// Preprost REST API za pošiljanje SMS sporočil.
// Basic Auth: API Username : API Password
//
// Dokumentacija: https://46elks.com/docs/send-sms
// Cenik: https://46elks.com/pricing (plačilo po porabi)
// ============================================================

/** Konfiguracija za 46elks SMS (shranjena na Organization). */
export interface SmsConfig {
  /** 46elks API Username (iz dashboarda). */
  apiKey: string
  /** 46elks API Password. */
  apiPassword: string
  /** Ime pošiljatelja (alphanumeric sender ID, npr. "MARKEC"). */
  senderName: string
  /** Opcijsko: webhook URL za delivery reports. */
  deliveryWebhookUrl?: string
}

const SMS_API_URL = "https://api.46elks.com/a1/sms"

/** Rezultat pošiljanja SMS. */
export type SmsResult =
  | {
      ok: true
      messageId: string
      status: string
      /** Število delov sporočila (1 del = 160 znakov GSM-7). */
      parts: number
    }
  | {
      ok: false
      error: string
    }

// ── Validation ───────────────────────────────────────────────

/**
 * Preveri ali je telefonska številka v E.164 formatu.
 * Slovenske številke: +386xxxxxxxx
 */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone.trim())
}

/**
 * Normaliziraj slovensko telefonsko številko v E.164.
 * Podpira: 041 234 567, 041234567, +38641234567, 38641234567
 */
export function normalizeSlovenianPhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-().]/g, "")

  // Že E.164
  if (cleaned.startsWith("+386")) return cleaned
  if (cleaned.startsWith("+")) return isValidE164(cleaned) ? cleaned : null

  // Slovenska brez +
  if (cleaned.startsWith("386")) return `+${cleaned}`
  if (cleaned.startsWith("0") && cleaned.length >= 8) {
    return `+386${cleaned.slice(1)}`
  }

  return null
}

/**
 * Izračunaj število SMS delov.
 * GSM-7: 160 znakov (1 del), 153 znakov (več delov).
 * UCS-2 (emoji, posebni znaki): 70 znakov (1 del), 67 (več delov).
 */
export function countSmsParts(message: string): number {
  const isGsm7 = /^[\x00-\x7F€¡¿ÄÖÑÜ§äöñüàáâèéêìíîòóôùúÿÀÁÂÈÉÊÌÍÎÒÓÔÙÚçÇßΓΔΘΛΞΠΣΦΨΩäöñüàáâèéêìíîòóôùúÿ]*$/.test(message)

  if (isGsm7) {
    return message.length <= 160 ? 1 : Math.ceil(message.length / 153)
  }
  // UCS-2
  return message.length <= 70 ? 1 : Math.ceil(message.length / 67)
}

// ── Send SMS ─────────────────────────────────────────────────

/**
 * Pošlji SMS prek 46elks API.
 *
 * @param cfg      — SMS konfiguracija (API podatki)
 * @param to       — Telefonska številka prejemnika (E.164)
 * @param message  — Vsebina sporočila (do 1600 znakov)
 * @param options  — Dodatne možnosti (from override, webhook)
 */
export async function sendSms(
  cfg: SmsConfig,
  to: string,
  message: string,
  options?: {
    from?: string
    whendelivered?: string
  }
): Promise<SmsResult> {
  // Validacija
  if (!cfg.apiKey?.trim() || !cfg.apiPassword?.trim()) {
    return { ok: false, error: "SMS API ni nastavljen (manjka API ključ)." }
  }

  const normalizedPhone = normalizeSlovenianPhone(to) ?? (isValidE164(to) ? to.trim() : null)
  if (!normalizedPhone) {
    return { ok: false, error: `Neveljavna telefonska številka: ${to}` }
  }

  if (!message?.trim()) {
    return { ok: false, error: "Sporočilo je prazno." }
  }

  if (message.length > 1600) {
    return { ok: false, error: "Sporočilo je predolgo (največ 1600 znakov)." }
  }

  const from = options?.from ?? cfg.senderName ?? "MARKEC"
  const auth = Buffer.from(`${cfg.apiKey}:${cfg.apiPassword}`).toString("base64")

  const params = new URLSearchParams({
    from,
    to: normalizedPhone,
    message: message.trim(),
  })

  // Delivery reports webhook (opcija)
  const webhookUrl = options?.whendelivered ?? cfg.deliveryWebhookUrl
  if (webhookUrl) {
    params.set("whendelivered", webhookUrl)
  }

  try {
    const res = await fetch(SMS_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    })

    const json = await res.json().catch(() => null)

    if (!res.ok) {
      return {
        ok: false,
        error:
          (json as { detail?: string })?.detail ??
          `Napaka ${res.status}: ${res.statusText}`,
      }
    }

    const data = json as {
      id: string
      status: string
      parts?: number
    }

    return {
      ok: true,
      messageId: data.id,
      status: data.status,
      parts: data.parts ?? countSmsParts(message),
    }
  } catch (err) {
    return {
      ok: false,
      error: `Omrežna napaka: ${String(err).slice(0, 200)}`,
    }
  }
}

// ── SMS templates ────────────────────────────────────────────

/**
 * Predloge SMS sporočil (slovensko).
 * Vsaka predloga uporablja {{placeholder}} za dinamične dele.
 */
export const SMS_TEMPLATES = {
  /** Opomnik za termin (24h prej). */
  appointmentReminder: (data: {
    serviceName: string
    date: string
    time: string
    businessName: string
  }) =>
    `Opomnik: Vaš termin "${data.serviceName}" je ${data.date} ob ${data.time}. Se vidimo! — ${data.businessName}`,

  /** Potrditev rezervacije. */
  bookingConfirmed: (data: {
    serviceName: string
    date: string
    time: string
    businessName: string
  }) =>
    `Rezervirano: "${data.serviceName}" ${data.date} ob ${data.time}. Hvala za zaupanje! — ${data.businessName}`,

  /** Naročilo pripravljeno za prevzem. */
  orderReady: (data: {
    orderNumber: string
    businessName: string
  }) =>
    `Vaše naročilo #${data.orderNumber} je pripravljeno za prevzem. — ${data.businessName}`,

  /** Naročilo poslano. */
  orderShipped: (data: {
    orderNumber: string
    trackingUrl?: string
    businessName: string
  }) =>
    `Naročilo #${data.orderNumber} je poslano.${data.trackingUrl ? ` Sledenje: ${data.trackingUrl}` : ""} — ${data.businessName}`,

  /** Walking: klic na vrsto. */
  walkInYourTurn: (data: {
    ticketCode: string
    businessName: string
  }) =>
    `Na vrsti ste! Vstopite prosim. Vaša številka: ${data.ticketCode}. — ${data.businessName}`,

  /** Walk-in: kmalu na vrsti. */
  walkInUpNext: (data: {
    ticketCode: string
    positionsAhead: number
    businessName: string
  }) =>
    `Kmalu na vrsti! Pred vami je še ${data.positionsAhead} oseb. Številka: ${data.ticketCode}. — ${data.businessName}`,

  /** Splošno obvestilo. */
  generic: (data: { message: string; businessName: string }) =>
    `${data.message} — ${data.businessName}`,
} as const

// ── Phone extraction helpers ─────────────────────────────────

/**
 * Varno pridobi telefonsko številko iz Customer record.
 * Vrne null, če številka ni veljavna.
 */
export function getCustomerPhone(customer: {
  phone?: string | null
  phoneNumber?: string | null
}): string | null {
  const raw = customer.phone ?? customer.phoneNumber
  if (!raw?.trim()) return null
  return normalizeSlovenianPhone(raw) ?? (isValidE164(raw) ? raw.trim() : null)
}
