import type { Metadata } from "next"
import { InvitationAccept } from "@/components/auth/invitation-accept"
import { prisma } from "@/lib/prisma"
import { hashInvitationToken } from "@/lib/invitations/hash"

export const metadata: Metadata = {
  title: "Sprejem povabila | MARKEC",
  robots: { index: false, follow: false },
}

/**
 * #100 F2.2 — SPREJEM POVABILA v poslovni prostor.
 * Javni /invite/[token] prikaže ime podjetja in omogoči sprejem.
 * F2.2.1: token se hashira za iskanje (DB hrani samo hash).
 * Samo prijavljen prejemnik (e-pošta == povabilo) lahko sprejme.
 */
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  // Varnost: org ime povabilo ne razkrije, če je žeton neveljaven.
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { token: hashInvitationToken(token) },
    include: {
      organization: { select: { id: true, name: true, status: true } },
    },
  })

  if (
    !invitation ||
    invitation.status !== "PENDING" ||
    invitation.organization.status !== "ACTIVE" ||
    (invitation.expiresAt && invitation.expiresAt < new Date())
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="mx-auto w-full max-w-md text-center">
          <h1 className="text-xl font-semibold">Povabilo ni več veljavno</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            To povabilo je bilo preklicano, je poteklo ali pa poslovni prostor
            ni več aktiven. Prosite skrbnika za novo povabilo.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <InvitationAccept
        organizationName={invitation.organization.name}
        role={invitation.role}
        invitedEmail={invitation.email}
        token={token}
      />
    </main>
  )
}
