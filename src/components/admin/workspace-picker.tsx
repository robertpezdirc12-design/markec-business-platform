"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { switchActiveOrganization } from "@/app/actions/organization-switch"
import type { WorkspaceCard } from "@/app/actions/workspaces"
import { toast } from "sonner"
import {
  ScissorsIcon,
  SpinnerIcon,
  WrenchIcon,
  StorefrontIcon,
} from "@/components/icons"

// Lightweight vertical icon pick for the picker cards (optional — an
// undefined vertical falls back to a neutral StorefrontIcon).
const VERTICAL_ICONS: Record<
  string,
  { icon: typeof ScissorsIcon; className: string }
> = {
  seamstress: { icon: ScissorsIcon, className: "text-primary" },
  mehanik: { icon: WrenchIcon, className: "text-accent" },
  "tire-service": { icon: WrenchIcon, className: "text-accent" },
}
const FALLBACK_ICON = { icon: StorefrontIcon, className: "text-primary" }

export function WorkspacePicker({
  workspaces,
  targetPath = "/dashboard",
}: {
  workspaces: WorkspaceCard[]
  /**
   * F2.1: the surface the chosen workspace opens. ADMIN lands on the
   * admin dashboard; STAFF lands on the staff portal. We push the
   * role-correct path directly instead of relying on the proxy to
   * redirect a hard-coded /dashboard (which is an unnecessary round-trip
   * and a confusing URL flicker for non-admin roles).
   */
  targetPath?: string
}) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // F2.0: `isActive` is also enterable. The board is the post-login landing
  // page for anyone with 2+ workspaces, so disabling the ACTIVE card used to
  // leave the user with no way into their current workspace at all.
  async function enter(id: string, isActive: boolean) {
    setPendingId(id)
    startTransition(async () => {
      // Switching onto the already-active workspace is a no-op — skip the
      // server action (and its DB write) and go straight to the dashboard.
      if (!isActive) {
        const res = await switchActiveOrganization(id)
        if (!res.success) {
          toast.error(res.error ?? "Preklop ni uspel.")
          setPendingId(null)
          return
        }
        toast.success(res.organizationName, {
          description: "Odprem nadzorno ploščo.",
        })
      }
      // NOTE: do NOT call router.refresh() after router.push() — it runs
      // synchronously and cancels the pending navigation, leaving the user on
      // /workspaces after a successful switch. switchActiveOrganization
      // already updated the session cookie, and the target surface re-reads
      // it server-side on navigation.
      router.push(targetPath)
    })
  }

  return (
    <>
      {workspaces.map((ws) => {
        const { icon: Icon, className: iconClass } =
          (ws.vertical && VERTICAL_ICONS[ws.vertical]) || FALLBACK_ICON
        const loading = isPending && pendingId === ws.id
        // F2.0: never disable the active card — only guard against a
        // concurrent switch already in flight.
        const disabled = isPending
        return (
          <div
            key={ws.id}
            role="group"
            aria-label={ws.name}
            className={cn(
              "bg-card flex min-w-0 flex-col rounded-xl border p-6 shadow-sm transition-all duration-200",
              ws.isActive && "border-primary ring-primary/30 ring-1",
              !disabled && "hover:shadow-md"
            )}
          >
            {/* F2.0: min-w-0 on EVERY flex ancestor so `truncate` can actually
                shrink the heading. Without it a long company name expanded the
                whole grid past a 390px phone viewport and pushed the badge
                outside the card on desktop. */}
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div
                  className={cn(
                    "bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                    iconClass
                  )}
                >
                  <Icon size={22} weight="duotone" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <h2
                    className="truncate leading-tight font-semibold"
                    title={ws.name}
                  >
                    {ws.name}
                  </h2>
                  <p className="text-muted-foreground truncate text-sm">
                    {ws.verticalLabel ?? "Poslovni prostor"}
                  </p>
                </div>
              </div>
              {/* F2.0: "Zadnji uporabljeni" is deliberately a DIFFERENT word
                  from "Privzeti prostor" — they are two separate concepts. */}
              {ws.isActive && (
                <Badge
                  variant="success"
                  className="shrink-0"
                  title="Prostor, v katerem si delal nazadnje; obnovi se ob prijavi."
                >
                  Zadnji uporabljeni
                </Badge>
              )}
            </div>

            <div className="text-muted-foreground mt-4 flex min-w-0 flex-wrap items-center gap-2 text-xs">
              <span className="bg-muted rounded-md px-2 py-0.5 font-medium tracking-wide uppercase">
                {ws.role}
              </span>
              {ws.isDefault && (
                <span title="Rezerva: uporabi se, če zadnji uporabljeni prostor ni več na voljo.">
                  Privzeti prostor
                </span>
              )}
            </div>

            <Button
              type="button"
              className="mt-5 w-full"
              variant={ws.isActive ? "outline" : "default"}
              disabled={disabled}
              onClick={() => enter(ws.id, ws.isActive)}
            >
              {loading && (
                <SpinnerIcon size={16} className="mr-2 animate-spin" />
              )}
              {ws.isActive ? "Odpri nadzorno ploščo" : "Vstopi"}
            </Button>
          </div>
        )
      })}
    </>
  )
}
