"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ensureSelfServiceWorkspace } from "@/app/actions/onboarding"
import { Loader2, Sparkles, AlertCircle } from "lucide-react"
import Link from "next/link"

export default function SelfServicePage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const result = await ensureSelfServiceWorkspace()
        if (cancelled) return

        if (result.ok) {
          const params = new URLSearchParams(window.location.search)
          const next = params.get("next")

          let target = "/dashboard"
          if (result.created) {
            // Fresh self-service workspace: take the user to the clear
            // module-selection step so they can choose and enable modules.
            target = "/dashboard/setup?welcome=1"
          } else {
            // Existing workspace resolved — honor intended destination when safe,
            // otherwise go to dashboard.
            const safeNext =
              next && next.startsWith("/") && !next.startsWith("//") ? next : null
            target = safeNext || "/dashboard"
          }

          // Full navigation so the updated session cookie (set by the server
          // action) is picked up reliably on the next request.
          window.location.assign(target)
          return
        }

        if (result.error === "NO_ACTIVE_WORKSPACE") {
          router.replace("/workspaces")
          return
        }

        setError(result.error || "Pri pripravi prostora je prišlo do napake.")
      } catch {
        if (!cancelled) {
          setError("Pri pripravi prostora je prišlo do napake. Poskusite znova.")
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [router])

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold">Ne moremo pripraviti prostora</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => {
                setError(null)
                router.replace("/self-service")
                router.refresh()
              }}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Poskusi znova
            </button>
            <Link
              href="/workspaces"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Moji prostori
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold">Pripravljamo vaš poslovni prostor</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Samodejno nastavljamo organizacijo, da lahko takoj izberete in vklopite module.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Samo trenutek…</span>
        </div>
      </div>
    </div>
  )
}
