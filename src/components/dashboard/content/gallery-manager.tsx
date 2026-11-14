"use client"

// ============================================================
// F5.5.2 — Galerijski upravitelj (dashboard).
// Podjetnik ustvari več galerij, vsaki doda fotografije (iz obstoječe
// medijske plasti / novega uploada), uredi podnapise + ALT, vrstni red,
// naslovno fotografijo, javno vidnost in povezave (storitev/izdelek/
// projekt). Vse je osnutek, dokler se ne objavi prek publishSite.
// Fotografije so REFERENCE — brisanje galerije nikoli ne zbriše media.
// ============================================================

import { useState, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { PlusIcon, PencilIcon, TrashIcon, ImageIcon, UploadIcon } from "@/components/icons"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import type { GalleryDTO, GalleryItemDTO } from "@/app/actions/galleries"
import {
  createGallery,
  updateGallery,
  deleteGallery,
  addGalleryItem,
  updateGalleryItem,
  removeGalleryItem,
  getAdminGallery,
} from "@/app/actions/galleries"
import { useI18n } from "@/lib/i18n/provider"

interface LinkOption {
  id: string
  name: string
}

interface GalleryManagerProps {
  initial: GalleryDTO[]
  services: LinkOption[]
  products: LinkOption[]
  projects: LinkOption[]
}

type LinkKind = "none" | "service" | "product" | "project"

interface GalleryEditor {
  id: string
  title: string
  description: string
  coverImageId: string
  isPublic: boolean
  linkKind: LinkKind
  linkValue: string
}

export function GalleryManager({
  initial,
  services,
  products,
  projects,
}: GalleryManagerProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [galleries] = useState<GalleryDTO[]>(initial)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<GalleryEditor>({
    id: "",
    title: "",
    description: "",
    coverImageId: "",
    isPublic: true,
    linkKind: "none",
    linkValue: "",
  })
  const [busy, setBusy] = useState(false)

  // Selected gallery expanded for item management.
  const [selected, setSelected] = useState<{
    data: GalleryDTO & { items: GalleryItemDTO[] }
  } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pasteUrl, setPasteUrl] = useState("")
  const [itemBusy, setItemBusy] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = () => router.refresh()

  const openCreate = () => {
    setEditingId(null)
    setForm({
      id: "",
      title: "",
      description: "",
      coverImageId: "",
      isPublic: true,
      linkKind: "none",
      linkValue: "",
    })
    setOpen(true)
  }

  const openEdit = (g: GalleryDTO) => {
    setEditingId(g.id)
    const linked: LinkKind = g.linkedServiceId
      ? "service"
      : g.linkedProductId
        ? "product"
        : g.linkedProjectId
          ? "project"
          : "none"
    setForm({
      id: g.id,
      title: g.title,
      description: g.description ?? "",
      coverImageId: g.coverImageId ?? "",
      isPublic: g.isPublic,
      linkKind: linked,
      linkValue: g.linkedServiceId ?? g.linkedProductId ?? g.linkedProjectId ?? "",
    })
    setOpen(true)
  }

  const submitGallery = async () => {
    if (!form.title.trim()) {
      toast.error(t.settings.content.mustHaveTitle)
      return
    }
    const link =
      form.linkKind === "none"
        ? {}
        : form.linkKind === "service"
          ? { linkedServiceId: form.linkValue || null }
          : form.linkKind === "product"
            ? { linkedProductId: form.linkValue || null }
            : { linkedProjectId: form.linkValue || null }
    setBusy(true)
    try {
      const res = editingId
        ? await updateGallery(editingId, {
            title: form.title.trim(),
            description: form.description.trim() || null,
            coverImageId: form.coverImageId || null,
            isPublic: form.isPublic,
            ...link,
          })
        : await createGallery({
            title: form.title.trim(),
            description: form.description.trim() || null,
            coverImageId: form.coverImageId || null,
            isPublic: form.isPublic,
            ...link,
          })
      if (!res.ok) {
        toast.error(res.error || "Napaka pri shranjevanju.")
        return
      }
      toast.success(t.settings.content.saveGallerySuccess)
      setOpen(false)
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const removeGallery = async (g: GalleryDTO) => {
    if (!window.confirm(t.settings.content.deleteGalleryConfirm)) return
    setBusy(true)
    try {
      const res = await deleteGallery(g.id)
      if (!res.ok) {
        toast.error(res.error || "Napaka pri brisanju.")
        return
      }
      if (selected?.data.id === g.id) setSelected(null)
      toast.success(t.settings.content.galleryDeleted)
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const openEditor = async (g: GalleryDTO) => {
    const full = await getAdminGallery(g.id)
    if (!full) return
    setSelected({ data: full })
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error(t.settings.content.uploadFailed)
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t.settings.content.uploadFailed)
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("type", "gallery")
      const resp = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await resp.json()
      if (!resp.ok || !data.url) {
        toast.error(data.error || t.settings.content.uploadFailed)
        return
      }
      await addToGallery(data.url)
    } catch {
      toast.error(t.settings.content.uploadFailed)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const addPasted = async () => {
    const url = pasteUrl.trim()
    if (!url) return
    await addToGallery(url)
    setPasteUrl("")
  }

  const addToGallery = async (mediaId: string) => {
    if (!selected) return
    const res = await addGalleryItem({
      galleryId: selected.data.id,
      mediaId,
      isPublished: false,
    })
    if (!res.ok) {
      toast.error(res.error || t.settings.content.uploadFailed)
      return
    }
    await reloadEditor()
  }

  const reloadEditor = async () => {
    if (!selected) return
    const full = await getAdminGallery(selected.data.id)
    if (full) setSelected({ data: full })
  }

  const updateItem = async (
    id: string,
    patch: { caption?: string | null; alt?: string | null; position?: number; isPublished?: boolean }
  ) => {
    setItemBusy(id)
    try {
      const res = await updateGalleryItem(id, patch)
      if (!res.ok) toast.error(res.error || "Napaka pri shranjevanju.")
      await reloadEditor()
    } finally {
      setItemBusy(null)
    }
  }

  const moveItem = async (index: number, dir: -1 | 1) => {
    if (!selected) return
    const next = [...selected.data.items]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    const tmp = next[index]
    next[index] = next[j]
    next[j] = tmp
    await updateGalleryItem(next[index].id, { position: index })
    await updateGalleryItem(next[j].id, { position: j })
    await reloadEditor()
  }

  const setCover = async (item: GalleryItemDTO) => {
    if (!selected) return
    await updateGallery(selected.data.id, { coverImageId: item.mediaId })
    await reloadEditor()
    refresh()
  }

  const removeItem = async (item: GalleryItemDTO) => {
    setItemBusy(item.id)
    try {
      const res = await removeGalleryItem(item.id)
      if (!res.ok) toast.error(res.error || "Napaka pri brisanju.")
      await reloadEditor()
      refresh()
    } finally {
      setItemBusy(null)
    }
  }

  const linksFor = (kind: LinkKind) =>
    kind === "service" ? services : kind === "product" ? products : projects

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{t.settings.content.galleriesSection}</CardTitle>
          <CardDescription>{t.settings.content.galleriesHint}</CardDescription>
        </div>
        <Button size="sm" onClick={openCreate}>
          <PlusIcon className="mr-1 h-4 w-4" />
          {t.settings.content.newGallery}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {galleries.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t.settings.content.emptyState}
          </p>
        )}
        {galleries.map((g) => {
          const linked =
            g.linkedServiceId
              ? `${t.settings.content.linkService}: ${
                  services.find((s) => s.id === g.linkedServiceId)?.name ?? "—"
                }`
              : g.linkedProductId
                ? `${t.settings.content.linkProduct}: ${
                    products.find((p) => p.id === g.linkedProductId)?.name ?? "—"
                  }`
                : g.linkedProjectId
                  ? `${t.settings.content.linkProject}`
                  : null
          return (
            <div
              key={g.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
            >
              {g.coverImageId ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border">
                  <Image
                    src={g.coverImageId}
                    alt={g.title}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{g.title}</span>
                  {g.isPublished ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {t.settings.content.publishedBadge}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      {t.settings.content.draftBadge}
                    </Badge>
                  )}
                  {!g.isPublic && (
                    <Badge variant="outline" className="text-[10px]">
                      {t.settings.content.publicLabel} ✕
                    </Badge>
                  )}
                </div>
                {g.description && (
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                    {g.description}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {g.itemCount} {g.itemCount === 1 ? "fotografija" : "fotografij"}
                  {linked ? ` · ${linked}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditor(g)}
                >
                  {t.settings.content.addPhoto}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t.settings.content.saveGallery}
                  onClick={() => openEdit(g)}
                >
                  <PencilIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t.settings.content.deleteGallery}
                  onClick={() => removeGallery(g)}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>

      {/* ===== Create / edit gallery dialog ===== */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? t.settings.content.saveGallery
                : t.settings.content.newGallery}
            </DialogTitle>
            <DialogDescription>{t.settings.content.galleriesHint}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gallery-title">{t.settings.content.galleryTitle}</Label>
              <Input
                id="gallery-title"
                value={form.title}
                placeholder={t.settings.content.galleryTitlePlaceholder}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gallery-description">{t.settings.content.galleryDescription}</Label>
              <Textarea
                id="gallery-description"
                rows={3}
                value={form.description}
                placeholder={t.settings.content.galleryDescriptionPlaceholder}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.settings.content.linkedTo}</Label>
              <Select
                value={form.linkKind}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, linkKind: v as LinkKind, linkValue: "" }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t.settings.content.linkNone}</SelectItem>
                  <SelectItem value="service">{t.settings.content.linkService}</SelectItem>
                  <SelectItem value="product">{t.settings.content.linkProduct}</SelectItem>
                  {projects.length > 0 && (
                    <SelectItem value="project">{t.settings.content.linkProject}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {form.linkKind !== "none" && (
                <Select
                  value={form.linkValue}
                  onValueChange={(v) => setForm((f) => ({ ...f, linkValue: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t.settings.content.linkedTo}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {linksFor(form.linkKind).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>{t.settings.content.publicLabel}</Label>
                <p className="text-xs text-muted-foreground">
                  {t.settings.content.publicHint}
                </p>
              </div>
              <Switch
                checked={form.isPublic}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isPublic: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Prekliči
            </Button>
            <Button onClick={submitGallery} disabled={busy}>
              {busy
                ? t.settings.content.saving
                : t.settings.content.saveGallery}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Gallery editor (items) ===== */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-3xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.data.title}</DialogTitle>
                <DialogDescription>
                  {selected.data.items.length} fotografij ·{" "}
                  {selected.data.isPublic
                    ? t.settings.content.publicLabel
                    : t.settings.content.publicLabel + " ✕"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUpload}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadIcon className="mr-1 h-4 w-4" />
                    {t.settings.content.uploadPhoto}
                  </Button>
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      id="gallery-media-url"
                      value={pasteUrl}
                      placeholder={t.settings.content.mediaUrlPlaceholder}
                      onChange={(e) => setPasteUrl(e.target.value)}
                    />
                    <Button size="sm" onClick={addPasted} disabled={!pasteUrl.trim()}>
                      {t.settings.content.addMedia}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.settings.content.uploadPhotoHint} · {t.settings.content.orPasteUrl}
                </p>

                {selected.data.items.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {t.settings.content.noItems}
                  </p>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {selected.data.items.map((item, idx) => (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
                        <Image
                          src={item.mediaId}
                          alt={item.alt ?? ""}
                          fill
                          className="object-cover"
                          sizes="(min-width: 640px) 50vw, 100vw"
                        />
                        {selected.data.coverImageId === item.mediaId && (
                          <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            {t.settings.content.useAsCover}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={t.settings.content.moveUp}
                            disabled={idx === 0 || itemBusy === item.id}
                            onClick={() => moveItem(idx, -1)}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={t.settings.content.moveDown}
                            disabled={idx === selected.data.items.length - 1 || itemBusy === item.id}
                            onClick={() => moveItem(idx, 1)}
                          >
                            ↓
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={selected.data.coverImageId === item.mediaId || itemBusy === item.id}
                            onClick={() => setCover(item)}
                          >
                            {t.settings.content.setCover}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t.settings.content.removePhoto}
                            disabled={itemBusy === item.id}
                            onClick={() => removeItem(item)}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          placeholder={t.settings.content.photoCaption}
                          defaultValue={item.caption ?? ""}
                          onBlur={(e) => {
                            if ((e.target.value ?? "") !== (item.caption ?? ""))
                              updateItem(item.id, { caption: e.target.value || null })
                          }}
                        />
                        <Input
                          placeholder={t.settings.content.photoAlt}
                          defaultValue={item.alt ?? ""}
                          onBlur={(e) => {
                            if ((e.target.value ?? "") !== (item.alt ?? ""))
                              updateItem(item.id, { alt: e.target.value || null })
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Zapri
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}