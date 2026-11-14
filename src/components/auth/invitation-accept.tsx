"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SpinnerIcon } from "@/components/icons"
import {
  acceptInvitation,
  revokeInvitation,
} from "@/app/actions/workspace-management"
import { toast } from "sonner"

const ROLE_LABEL: Record<string, string> = { ADMIN: "Skrbnik", STAFF: "Osebje" }

export function InvitationAccept({
  organizationName,
  role,
  invitedEmail,
  token,
}: {
  organizationName: string
  role: string
  invitedEmail: string
  token: string
}) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [isPending, startTransition] = useTransition()
  const [outcome, setOutcome] = useState<"idle" | "accepted" | "rejected">(
    "idle"
  )

  const loggedInEmail = session?.user?.email?.toLowerCase() ?? null
  const emailMatches = loggedInEmail === invitedEmail.toLowerCase()

  function accept() {
    if (status === "unauthenticated") {
      router.push(
        `/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`
      )
      return
    }
    if (!emailMatches) {
      toast.error(
        "Prijavljeni račun se ne ujema z e-poštnim naslovom povabila."
      )
      return
    }
    startTransition(async () => {
      const res = await acceptInvitation(token)
      if (!res.success) {
        toast.error(res.error ?? "Napaka.")
        return
      }
      toast.success("Povabilo sprejeto.")
      setOutcome("accepted")
      router.refresh()
    })
  }

  function reject() {
    startTransition(async () => {
      const res = await revokeInvitation(token)
      if (!res.success && !res.error?.includes("ni več")) {
        toast.error(res.error ?? "Napaka.")
        return
      }
      toast.success("Povabilo zavrnjeno.")
      setOutcome("rejected")
    })
  }

  if (outcome === "accepted") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Povabilo sprejeto 🎉</CardTitle>
          <CardDescription>
            Zdaj si član {organizationName.trim()} (vloga{" "}
            {ROLE_LABEL[role] ?? role}).
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button className="w-full" onClick={() => router.push("/workspaces")}>
            Pojdi na poslovne prostore
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (outcome === "rejected") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Povabilo zavrnjeno</CardTitle>
          <CardDescription>
            Povabilo v {organizationName.trim()} je bilo zavrnjeno.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => router.push("/")}
          >
            Nazaj na domovino
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Povabilo v poslovni prostor</CardTitle>
        <CardDescription>
          <span className="font-medium">{organizationName}</span> te vabi, da se
          pridružiš kot {ROLE_LABEL[role] ?? role}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">E-poštni naslov</span>
          <Badge variant="muted">{invitedEmail}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Vloga</span>
          <Badge variant="outline">{ROLE_LABEL[role] ?? role}</Badge>
        </div>
        {status !== "loading" && loggedInEmail && !emailMatches && (
          <p className="text-destructive bg-destructive/10 rounded-md p-2 text-xs">
            Prijavljen si kot {loggedInEmail}. Ta račun se ne ujema z e-poštom
            povabila — odjavi se in sprejmi s pravega računa.
          </p>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          className="flex-1"
          onClick={accept}
          disabled={isPending || status === "loading"}
        >
          {isPending && <SpinnerIcon size={16} className="mr-2 animate-spin" />}
          Sprejmi povabilo
        </Button>
        <Button
          className="flex-1"
          variant="outline"
          onClick={reject}
          disabled={isPending}
        >
          Zavrni
        </Button>
      </CardFooter>
      <CardDescription className="px-6 pb-4 text-xs">
        Po sprejemu boš poslovni prostor videl med svojimi podjetji.
      </CardDescription>
    </Card>
  )
}
