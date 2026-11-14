"use client"

// ============================================================
// 2D-1E — Stanje B (prijavljen uporabnik, a brez aktivnega
// poslovnega prostora/organizacije): usmerimo na izbor prostora
// (/dashboard/workspaces). Uporablja client usePathname, da ne
// pride do neskončne preusmeritve layouta na lastno stran pod
// istim (admin) layoutom.
// Ne prijavlja / login, ne ustvarja organizacije, ne spreminja
// podatkov.
// ============================================================

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

export function NoOrgGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  // Ko je uporabnik prijavljen, a nima aktivne org: če ni že na
  // izboru prostorov (/workspaces), preusmeri tja (client zankanje, brez
  // neskončne preusmeritve).
  useEffect(() => {
    if (pathname !== "/workspaces" && !pathname.startsWith("/workspaces/")) {
      router.replace("/workspaces")
    }
  }, [pathname, router])

  // Na izboru prostorov naj se stran izriše normalno (picker pokaže
  // "na tem računu ni aktivnih prostorov", kadar jih ni).
  if (pathname === "/workspaces" || pathname.startsWith("/workspaces/")) {
    return <>{children}</>
  }

  // Drugje (pred preusmeritvijo) kratek neutral placeholder.
  return <div className="p-8 text-center text-muted-foreground">Nalaganje …</div>
}