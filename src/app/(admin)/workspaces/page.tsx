import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { getWorkspacePicker } from "@/app/actions/workspaces"
import { WorkspacePicker } from "@/components/admin/workspace-picker"

export const metadata: Metadata = {
  title: { absolute: "Izberi poslovni prostor | MARKEC" },
  robots: { index: false, follow: false },
}

/**
 * F1 #100 — VSTOPNA TABLA: uporabnik z več poslovnimi prostori na
 * računu po prijavi izbere, v katerega vstopi. En workspace nič
 * ne prikaže — uporabnik gre naravnost v dashboard (to se odloči
 * v preusmeritvi po prijavi, ne tu). Ta stran je dostopna tudi
 * ročno prek menija uporabnika ("Zamenjaj workspace").
 *
 * F2.0: strežniška vrata. Proxy je ščitil /dashboard, /staff-portal in
 * /my-account, ne pa /workspaces — neprijavljen obiskovalec je dobil
 * 200 z administratorskim šelom. Tukaj je avtoritativni redirect;
 * proxy ga dopolnjuje kot defense-in-depth, akcije pa ostanejo
 * fail-closed tudi brez seje (prazen seznam / zavrnjen preklop).
 */
export default async function WorkspacesPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Fworkspaces")
  }

  const { workspaces } = await getWorkspacePicker()

  // F2.1: open the role-correct surface. ADMIN -> admin dashboard,
  // STAFF -> staff portal, CLIENTE -> client area. Every other role
  // falls back to the admin dashboard (the proxy re-routes as a
  // defense-in-depth boundary anyway).
  const targetPath =
    session.user.role === "STAFF"
      ? "/staff-portal"
      : session.user.role === "CLIENTE"
        ? "/my-account"
        : "/dashboard"

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center py-12 sm:py-20">
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        Kam želiš danes vstopiti?
      </h1>
      <p className="text-muted-foreground mt-2 text-center">
        Izberi poslovni prostor. Nadzorna plošča, nastavitve in moduli se
        odprejo za izbrano dejavnost.
      </p>

      {workspaces.length === 0 ? (
        <div className="text-muted-foreground mt-10 text-center text-sm">
          Na tem računu ni aktivnih poslovnih prostorov.
        </div>
      ) : (
        <>
          {/* F2.0: explicit `grid-cols-1` creates a minmax(0,1fr) track, so a
              long workspace name can no longer expand the implicit `auto`
              column beyond a 390px phone viewport. */}
          <div className="mt-8 grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <WorkspacePicker workspaces={workspaces} targetPath={targetPath} />
          </div>
          {/* F2.0: the two concepts are deliberately named and explained —
              `isDefault` is a FALLBACK, not "the last one I used". */}
          <p className="text-muted-foreground mt-6 max-w-prose px-2 text-center text-xs leading-relaxed">
            <span className="text-foreground font-medium">Zadnji uporabljeni</span>{" "}
            je prostor, v katerem si delal nazadnje in se obnovi ob prijavi.{" "}
            <span className="text-foreground font-medium">Privzeti prostor</span>{" "}
            je rezerva — uporabi se samo, če zadnji uporabljeni prostor ni več
            na voljo.
          </p>
        </>
      )}
    </div>
  )
}
