import { Resend } from "resend"
import { render } from "@react-email/components"
import { PasswordResetTemplate } from "./templates/password-reset-template"
import { isEmailServiceConfigured } from "./config"

const resend = new Resend(
  process.env.RESEND_API_KEY || "re_placeholder_not_configured"
)

export async function sendPasswordResetEmail(email: string, token: string) {
  // 2D-5: fail fast when no real email service (placeholder key -> 401).
  if (!isEmailServiceConfigured()) {
    return { success: false, notConfigured: true, error: "Email service not configured" }
  }
  const from = process.env.RESEND_FROM_EMAIL
  if (!from) {
    return { success: false, notConfigured: true, error: "RESEND_FROM_EMAIL not configured" }
  }
  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`

  try {
    const html = await render(PasswordResetTemplate({ resetLink }))

    const { data, error } = await resend.emails.send({
      from,
      to: email,
      subject: "Reset Your Password - Business Platform",
      html,
    })

    if (error) {
      console.error("Resend error:", error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error("Email send error:", error)
    return { success: false, error: "Failed to send email" }
  }
}
