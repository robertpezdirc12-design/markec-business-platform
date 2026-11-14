import { Resend } from "resend"
import { isEmailServiceConfigured } from "@/lib/email/config"

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder_not_configured")

export interface BillingReminderEmailParams {
  email: string
  orgName: string
  plan: string
  /** "reminder" | "final" */
  kind: "reminder" | "final"
  /** Prilagoditev: koliko dni je še do suspenza (za "final" ni ključno). */
  daysLeft?: number
  /** Povezava za plačilo/nadgradnjo (prikažemo, če je). */
  billingHref: string
}

function htmlBody(p: BillingReminderEmailParams): string {
  const intro =
    p.kind === "final"
      ? `Vaša naročnina <strong>${p.plan}</strong> za <strong>${p.orgName}</strong> ni bila plačana in vašo javno stran bomo kmalu začasno ustavili.`
      : `Plačilo naročnine <strong>${p.plan}</strong> za <strong>${p.orgName}</strong> ni uspelo.`
  const detail =
    p.kind === "final"
      ? "Če ne uredite plačila, bo vaša stran začasno ustavljena. Vaši podatki ostanejo shranjeni — po plačilu bo stran spet živa."
      : `Če plačila ne uredite, bo vaša stran začasno ustavljena (vsaj po ${p.daysLeft ?? 7} dneh). Vaši podatki ostanejo vedno shranjeni — po plačilu bo stran spet živa.`
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#111">
    <h2 style="color:#111">Naročnina – zahteva plačilo</h2>
    <p>${intro}</p>
    <p>${detail}</p>
    <p style="margin:24px 0">
      <a href="${p.billingHref}" style="background:#111;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;display:inline-block">Uredi plačilo</a>
    </p>
    <p style="color:#555;font-size:13px">Brez skrbi: vaših podatkov nikoli ne izbrišemo. Po uspešnem plačilu se stran samodejno odpre.</p>
  </div>`
}

/**
 * Pošlje opomnik za neplačano naročnino (grace tok, točka 7b).
 * Fail-fast ko ni email servisa; nikoli ne vrže (cron job prijavi napako).
 */
export async function sendBillingReminderEmail(
  p: BillingReminderEmailParams
): Promise<{ success: boolean; notConfigured?: boolean }> {
  if (!isEmailServiceConfigured()) {
    return { success: false, notConfigured: true }
  }
  const from = process.env.RESEND_FROM_EMAIL
  if (!from) return { success: false, notConfigured: true }

  try {
    const { error } = await resend.emails.send({
      from,
      to: p.email,
      subject:
        p.kind === "final"
          ? `${p.orgName} — naročnino bomo kmalu ustavili`
          : `${p.orgName} — plačilo naročnine je neuspešno`,
      html: htmlBody(p),
    })
    if (error) {
      console.error("[billing-grace] Resend error:", error)
      return { success: false }
    }
    return { success: true }
  } catch (e) {
    console.error("[billing-grace] email send failed:", e)
    return { success: false }
  }
}