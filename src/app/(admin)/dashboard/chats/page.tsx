import { Card, CardContent } from "@/components/ui/card"
import { ChatsCircleIcon, EnvelopeIcon } from "@/components/icons"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"
import { getConversations } from "@/app/actions/reception-owner"
import { ReceptionInboxClient } from "@/components/admin/reception-inbox-client"

// ============================================================
// EPIC 5 — INBOX: pogovori skriptnega recepcionista
// Lastnik vidi pogovore, ki jih obiskovalci vodijo z avtomatskim
// sprejemom na javni strani, in jim odgovori (prvi odgovor označi
// pogovor REPLIED). Dovoljenje: appointments.view (isti prag kot
// waitlist) — E5-D7.
// ============================================================

export default async function ChatsPage() {
  await requirePagePermission("appointments.view")
  const [{ t }, result] = await Promise.all([getServerI18n(), getConversations()])
  const p = t.appointments.inbox

  const conversations = result.ok && result.conversations ? result.conversations : []
  const open = conversations.filter((c) => c.status === "ACTIVE").length
  const replied = conversations.filter((c) => c.status === "REPLIED").length

  const stats = [
    { label: p.statusActive, value: String(open), icon: EnvelopeIcon, accent: "text-primary-text" },
    { label: p.statusReplied, value: String(replied), icon: ChatsCircleIcon, accent: "text-emerald-500" },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {p.title} <span className="text-primary-text">{p.titleAccent}</span>
          </h1>
          <p className="text-muted-foreground">{p.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`rounded-lg bg-muted p-2 ${s.accent}`}>
                <s.icon size={18} />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none">{s.value}</div>
                <div className="text-muted-foreground mt-1 text-xs leading-tight">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ReceptionInboxClient conversations={conversations} />
    </div>
  )
}
