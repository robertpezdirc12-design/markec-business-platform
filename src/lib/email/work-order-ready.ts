import { Resend } from "resend"
import { getEmailConfig } from "./config"
import { readyEmailContent } from "@/lib/work-orders/ready-notification"

// ============================================================
// E-POŠTA: »Vaše naročilo je pripravljeno za prevzem«
//
// Pošlje se, ko naročilo preide v stopnjo predaje (advanceWorkOrder).
// Brez nastavljenega Resend ključa se ne pošlje nič in funkcija to
// pove (notConfigured) — klicatelj zato ne poroča o lažnem uspehu.
// ============================================================

const resend = new Resend(
  process.env.RESEND_API_KEY || "re_placeholder_not_configured"
)

export interface SendWorkOrderReadyParams {
  email: string
  businessName: string
  customerName: string | null
  orderNumber: number
  orderTitle: string
  dueDateLabel: string | null
  totalLabel: string | null
  publicUrl: string | null
}

export async function sendWorkOrderReadyEmail(
  params: SendWorkOrderReadyParams
): Promise<{ success: boolean; notConfigured?: boolean; error?: string }> {
  const config = getEmailConfig()
  if (!config) return { success: false, notConfigured: true, error: "NOT_CONFIGURED" }

  const { subject, lines } = readyEmailContent(params)

  try {
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#1f2937">
        ${lines
          .map((line, i) =>
            i === 0
              ? `<p style="font-size:16px;font-weight:600">${escapeHtml(line)}</p>`
              : `<p style="margin:6px 0">${escapeHtml(line)}</p>`
          )
          .join("")}
      </div>
    `

    const { error } = await resend.emails.send({
      from: config.from,
      to: params.email,
      subject,
      html,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (error) {
    console.error("[email] work order ready:", error)
    return { success: false, error: "SEND_FAILED" }
  }
}

/** Minimalno izhodno kodiranje (vsebina vsebuje imena in naslove). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
