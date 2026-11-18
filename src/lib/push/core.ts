// ============================================================
// #99 — PUSH + PWA (čista jedra)
// VAPID Web Push za lastnika: nov termin, odpoved. Dnevni digest
// gre po e-pošti (Resend, cron). Brez VAPID ključev je push pošteno
// izklopljen (nikoli lažni gumb — UI pokaže "ni nastavljeno").
// ============================================================

export type PushKind =
  | "new_appointment"
  | "cancellation"
  // #108 — walk-in: stranka dobi obvestilo, ko je na vrsti / ko se približuje.
  | "walkin_your_turn"
  | "walkin_up_next"
  // #108 — opomnik termina (push poleg e-pošte).
  | "appointment_reminder"

export interface PushPayload {
  kind: PushKind
  /** Naslov obvestila (kratko). */
  title: string
  /** Telo obvestila. */
  body: string
  /** Relativna ruta, ki jo ob klik odpre. */
  url: string
}

/** Sestavi payload iz vrste + podatkov — testabilno, enoten oblikovni jezik. */
export function buildPushPayload(
  kind: PushKind,
  data: { customerName?: string; date?: string; position?: number }
): PushPayload {
  switch (kind) {
    case "new_appointment":
      return {
        kind,
        title: "Nov termin",
        body: data.customerName
          ? `${data.customerName} je rezerviral nov termin${data.date ? ` za ${data.date}` : ""}.`
          : "Nov termin je bil rezerviran.",
        url: "/dashboard/appointments",
      }
    case "cancellation":
      return {
        kind,
        title: "Termin odpovedan",
        body: data.customerName
          ? `${data.customerName} je odpovedal termin${data.date ? ` za ${data.date}` : ""}.`
          : "Termin je bil odpovedan.",
        url: "/dashboard/appointments",
      }
    case "walkin_your_turn":
      return {
        kind,
        title: "Vi ste na vrsti! 🎉",
        body: "Pristopite k pultu — vaša vrsta je.",
        url: "/vrsta",
      }
    case "walkin_up_next":
      return {
        kind,
        title: "Na vrsti ste naslednji",
        body:
          data.position && data.position > 1
            ? `Pred vami je še ${data.position - 1} oseb. Pripravite se.`
            : "Pripravite se — na vrsti ste naslednji.",
        url: "/vrsta",
      }
    case "appointment_reminder":
      return {
        kind,
        title: "Opomnik za termin",
        body: data.date
          ? `Jutri ob ${data.date} imate termin. Se vidimo!`
          : "Jutri imate termin. Se vidimo!",
        url: "/my-appointments",
      }
  }
}

/** Push je konfiguriran samo z obema ključema (VAPID par). */
export function isPushConfigured(
  vapidPublicKey: string | undefined,
  vapidPrivateKey: string | undefined
): boolean {
  return (
    typeof vapidPublicKey === "string" &&
    vapidPublicKey.length > 0 &&
    typeof vapidPrivateKey === "string" &&
    vapidPrivateKey.length > 0
  )
}

export interface DigestStats {
  /** Salon-lokalen datum, za katerega digest govor ("danes"). */
  todayLabel: string
  /** Termin danes: število + kratki seznami (ura — storitev — stranka). */
  todayCount: number
  todayLines: string[]
  /** Nove rezervacije (zadnjih 24 h). */
  newBookings: number
  /** Odpovedi (zadnjih 24 h). */
  cancellations: number
  /** Termin jutri. */
  tomorrowCount: number
}

/** Dnevni digest e-pošta: poštena vsebina, samo dejstva iz podatkov. */
export function buildDigestEmail(stats: DigestStats): { subject: string; body: string } {
  const subject =
    stats.todayCount > 0
      ? `Povzetek dneva — ${stats.todayCount} terminov (${stats.todayLabel})`
      : `Povzetek dneva — brez terminov (${stats.todayLabel})`

  const lines: string[] = []
  if (stats.todayLines.length > 0) {
    lines.push("DANES:", ...stats.todayLines.map((l) => ` • ${l}`), "")
  } else {
    lines.push("Danes ni terminov.", "")
  }
  lines.push(`Nove rezervacije (24 h): ${stats.newBookings}`)
  lines.push(`Odpovedi (24 h): ${stats.cancellations}`)
  lines.push(`Termini jutri: ${stats.tomorrowCount}`)

  return { subject, body: lines.join("\n") }
}

/** Digest se pošlje samo, ko se je kaj zgodilo (brez vsakodnevnega šuma). */
export function digestWorthSending(stats: DigestStats): boolean {
  return (
    stats.todayCount > 0 ||
    stats.newBookings > 0 ||
    stats.cancellations > 0 ||
    stats.tomorrowCount > 0
  )
}
