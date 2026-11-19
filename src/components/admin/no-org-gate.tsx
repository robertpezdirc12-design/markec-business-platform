"use client"

// ============================================================
// 2D-1E / self-service — prijavljen uporabnik brez aktivnega
// poslovnega prostora: usmerimo na /self-service, ki samodejno
// ustvari/izbere prostor ali pošlje na izbor prostorov.
// ============================================================

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

export function NoOrgGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  // Ob aktivni seji brez organizacije prepusti pot /self-service (in
  // /workspaces), ki poskrbita za samodejno ustvarjanje ali izbor.
  useEffect(() => {
    if (status !== "authenticated") return
    if (session?.user?.organizationId) return

    const isWorkspaces =
      pathname === "/workspaces" || pathname.startsWith("/workspaces/")
    const isSelfService =
      pathname === "/self-service" || pathname.startsWith("/self-service/")
    const isStart = pathname === "/start" || pathname.startsWith("/start/")

    if (!isWorkspaces && !isSelfService && !isStart) {
      router.replace("/self-service")
    }
  }, [pathname, router, session?.user?.organizationId, status])

  const isWorkspaces =
    pathname === "/workspaces" || pathname.startsWith("/workspaces/")
  const isSelfService =
    pathname === "/self-service" || pathname.startsWith("/self-service/")
  const isStart = pathname === "/start" || pathname.startsWith("/start/")

  if (isWorkspaces || isSelfService || isStart) {
    return <>{children}</>
  }

  // Če ni organizacije, /self-service poskrbi za nadaljevanje.
  if (status === "authenticated" && !session?.user?.organizationId) {
    return <div className="p-8 text-center text-muted-foreground">Nalaganje …</div>
  }

  return <>{children}</>
}
