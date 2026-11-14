// ============================================================
// F5.5.2 — Vsebina (galerije + FAQ) — strežniški kontejner.
// Naloži admin pregled galerij in FAQ ter opcije povezovanja
// (storitve/izdelki/projekti) in jih preda klientnim upraviteljem.
// Vsi odčitki so org-scoped (settings.manage).
// ============================================================

import { getAdminGalleries } from "@/app/actions/galleries"
import { getAdminFaq } from "@/app/actions/faq"
import { getAdminServices } from "@/app/actions/services"
import { getAdminProducts } from "@/app/actions/products"
import { GalleryManager } from "./gallery-manager"
import { FaqManager } from "./faq-manager"

interface LinkOption {
  id: string
  name: string
}

// Projekti živijo pod delovnimi naročili (workorders module). Modul je lahko
// izklopljen; takrat vezava na projekt preprosto ni na voljo (ne klicemo, da
// ne bi vrgli EXTENSION_OFF). Projekte poskusno razrešimo, odporne na napako.
async function loadProjects(): Promise<LinkOption[]> {
  try {
    const mod = await import("@/app/actions/projects")
    const res = await mod.listProjects()
    if ("projects" in res) {
      return res.projects.map((p) => ({
        id: p.id,
        name: p.name || "Projekt",
      }))
    }
    return []
  } catch {
    return []
  }
}

export async function ContentManager() {
  const [galleries, faq, services, productResult, projects] = await Promise.all([
    getAdminGalleries().catch(() => []),
    getAdminFaq().catch(() => []),
    getAdminServices().catch(() => [] as LinkOption[]),
    getAdminProducts().catch(() => null),
    loadProjects(),
  ])

  const serviceOptions: LinkOption[] = services.map((s) => ({
    id: s.id,
    name: s.name,
  }))
  const productOptions: LinkOption[] = (productResult?.products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }))

  return (
    <div className="space-y-6">
      <GalleryManager
        initial={galleries}
        services={serviceOptions}
        products={productOptions}
        projects={projects}
      />
      <FaqManager initial={faq} services={serviceOptions} />
    </div>
  )
}