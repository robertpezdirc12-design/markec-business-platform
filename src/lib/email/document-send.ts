// ============================================================
// F5.5.4.3 — POŠILJANJE DOKUMENTA PO E-POŠTI (obstoječa Resend infra).
//
// Ponovno uporablja isEmailServiceConfigured() + Resend (src/lib/email
// /config.ts). Objekt (PDF) se pošlje kot priloga iz arhiva. Rezultat je
// NEPRISTNO pošiljanje SENT le ob dejanski potrditvi ponudnika; FAJLED ob
// napaki; kadar API ključ ni konfiguriran, vrnemo UNSENT (nikoli ne
// trdimo, da je bilo poslano).
// ============================================================

import { Resend } from "resend"
import { render } from "@react-email/components"
import { isEmailServiceConfigured } from "@/lib/email/config"
import { DocumentSendTemplate } from "@/lib/email/templates/document-send-template"

export type EmailOutcome = "SENT" | "FAILED" | "UNSENT"

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder_not_configured")

export interface SendDocumentEmailParams {
  toEmail: string
  docCode: string
  doctype: string
  customerName: string
  issuerName: string
  totalLabel: string
  subject: string
  /** base64 priloge (PDF iz arhiva) */
  attachmentBase64: string
  attachmentFilename: string
  attachmentMime?: string
}

/**
 * Pošlje dokument kot e-poštno prilogo. Vrne status (SENT le ob potrditvi,
 * FAILED ob napaki ponudnika, UNSENT brez konfiguriranega ponudnika).
 */
export async function sendDocumentEmail(params: SendDocumentEmailParams): Promise<{
  status: EmailOutcome
  error?: string
  messageId?: string
}> {
  if (!isEmailServiceConfigured()) {
    return { status: "UNSENT", error: "Email service not configured" }
  }
  const from = process.env.RESEND_FROM_EMAIL
  if (!from) return { status: "FAILED", error: "RESEND_FROM_EMAIL not configured" }

  try {
    const html = await render(
      DocumentSendTemplate({
        docCode: params.docCode,
        doctype: params.doctype,
        customerName: params.customerName,
        issuerName: params.issuerName,
        totalLabel: params.totalLabel,
      })
    )
    const { data, error } = await resend.emails.send({
      from,
      to: params.toEmail,
      subject: params.subject,
      html,
      attachments: [
        {
          filename: params.attachmentFilename,
          content: params.attachmentBase64,
          contentType: params.attachmentMime ?? "application/pdf",
          // Resend sprejme base64 pod ključem content.
        },
      ],
    })
    if (error) return { status: "FAILED", error: error.message }
    return { status: "SENT", messageId: data?.id }
  } catch (e) {
    const err = e instanceof Error ? e.message : "Failed to send email"
    return { status: "FAILED", error: err }
  }
}