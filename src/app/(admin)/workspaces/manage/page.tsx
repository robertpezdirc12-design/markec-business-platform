import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { listMyWorkspaces } from "@/app/actions/workspace-management"
import { WorkspaceManager } from "@/components/admin/workspace-manager"
import { listProfileOptions } from "@/lib/profiles/registry"

export const metadata: Metadata = {
  title: { absolute: "Moja podjetja in poslovni prostori | MARKEC" },
  robots: { index: false, follow: false },
}

/**
 * #100 F2.2 — UPRAVLJANJE PODJETIJ IN POSLOVNIH PROSTOROV.
 * "Moja podjetja": seznam workspace-ov na računu, ustvarjanje,
 * urejanje, arhiviranje, člani + povabila + privzeti prostor.
 * Vue: server nalož. podatke; WorkspaceManager = klient.
 */
export default async function ManageWorkspacesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=%2Fworkspaces%2Fmanage")

  const workspaces = await listMyWorkspaces()
  const profiles = listProfileOptions()

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Moja podjetja</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Upravljaj poslovne prostore na tem računu — vsi so ločeni po podatkih,
          članih in pravicah.
        </p>
      </header>

      <WorkspaceManager
        workspaces={workspaces}
        profiles={profiles.map((p) => ({ id: p.id, label: p.label }))}
      />
    </div>
  )
}
