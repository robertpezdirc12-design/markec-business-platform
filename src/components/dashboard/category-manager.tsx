"use client"

// ============================================================
// F5.2 — UPRAVLJANJE KATEGORIJ (podjetnikov vmesnik).
//
// Drevo kategorij s podkategorijami, iskanjem, ustvarjanjem,
// urejanjem, vrstnim redom, aktivacijo in varnim brisanjem.
// Vse mutacije gredo skozi server akcije (categories.ts), ki
// preverijo sejo, pravico in organizacijsko izolacijo.
// ============================================================

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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
import { ChevronUpIcon, ChevronDownIcon, PlusIcon, SearchIcon, PencilIcon, TrashIcon } from "@/components/icons"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n/provider"
import {
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  getCategoryDeletePreview,
  type ManagedCategory,
} from "@/app/actions/categories"
import type { CategoryType } from "@prisma/client"

interface ManagerForm {
  id?: string
  name: string
  parentId: string | null
  description: string
  image: string
  categoryType: CategoryType
  isActive: boolean
}

interface Props {
  initial: ManagedCategory[]
}

type FormMode = null | "create" | "edit"

export function CategoryManager({ initial }: Props) {
  const router = useRouter()
  const { t } = useI18n()
  const [query, setQuery] = useState("")
  const [mode, setMode] = useState<FormMode>(null)
  const [form, setForm] = useState<ManagerForm | null>(null)
  const [formParent, setFormParent] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ManagedCategory | null>(null)
  const [deletePreview, setDeletePreview] = useState<{ products: number; services: number; children: number } | null>(null)
  const [cascadeChildren, setCascadeChildren] = useState(false)
  const [pending, startTransition] = useTransition()

  // Seznam je vedno natanko to, kar je poslal strežnik: vsaka sprememba
  // sproži router.refresh(), zato lokalna kopija v stanju ni potrebna.
  const items = initial

  const roots = items
    .filter((i) => !i.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  const childrenOf = (parentId: string) =>
    items
      .filter((i) => i.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))

  const matches = (name: string) =>
    !query.trim() || name.toLowerCase().includes(query.trim().toLowerCase())

  const openCreate = (parentId: string | null) => {
    setFormParent(parentId)
    setMode("create")
  }
  const openEdit = (item: ManagedCategory) => {
    setFormParent(item.parentId)
    setMode("edit")
    setForm({
      id: item.id,
      name: item.name,
      parentId: item.parentId,
      description: item.description ?? "",
      image: item.image ?? "",
      categoryType: item.categoryType,
      isActive: item.isActive,
    })
  }

  async function submit() {
    if (!form || !form.name.trim()) return
    startTransition(async () => {
      if (mode === "create") {
        const res = await createCategory({
          name: form.name,
          parentId: formParent,
          description: form.description || null,
          image: form.image || null,
          categoryType: form.categoryType,
        })
        if (!res.success) { toast.error(res.error || t.categories.errorSave); return }
      } else {
        const res = await updateCategory({
          id: form.id!,
          name: form.name,
          parentId: form.parentId,
          description: form.description || null,
          image: form.image || null,
          categoryType: form.categoryType,
          isActive: form.isActive,
        })
        if (!res.success) { toast.error(res.error || t.categories.errorSave); return }
      }
      toast.success(t.categories.saved)
      setMode(null)
      setForm(null)
      router.refresh()
    })
  }

  async function move(item: ManagedCategory, dir: -1 | 1) {
    const siblings = item.parentId ? childrenOf(item.parentId) : roots
    const idx = siblings.findIndex((s) => s.id === item.id)
    const swap = siblings[idx + dir]
    if (!swap) return
    const ids = siblings.map((s) => s.id)
    ;[ids[idx], ids[idx + dir]] = [ids[idx + dir], ids[idx]]
    startTransition(async () => {
      const res = await reorderCategories(ids)
      if (!res.success) { toast.error(res.error || t.categories.errorSave); return }
      toast.success(t.categories.reorderSaved)
      router.refresh()
    })
  }

  async function toggleActive(item: ManagedCategory) {
    startTransition(async () => {
      const res = await updateCategory({ id: item.id, isActive: !item.isActive })
      if (!res.success) { toast.error(res.error || t.categories.errorSave); return }
      router.refresh()
    })
  }

  async function openDelete(item: ManagedCategory) {
    setDeleteTarget(item)
    setCascadeChildren(false)
    setDeletePreview(null)
    const preview = await getCategoryDeletePreview(item.id)
    setDeletePreview(
      preview.success && preview.data
        ? {
            products: preview.data.products,
            services: preview.data.services,
            children: preview.data.children,
          }
        : null
    )
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const res = await deleteCategory(deleteTarget.id, { cascadeChildren })
      if (!res.success) { toast.error(res.error || t.categories.errorDelete); return }
      toast.success(t.categories.deleted)
      setDeleteTarget(null)
      router.refresh()
    })
  }

  const renderRow = (item: ManagedCategory, depth: number) =>
    matches(item.name) ? (
      <div
        key={item.id}
        className="flex flex-col gap-2 border-b py-3 px-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"
        style={{ paddingLeft: `${depth * 1.5 + 1}rem` }}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.name}</span>
            {!item.isActive && (
              <span className="bg-muted rounded-md px-2 py-0.5 text-xs text-muted-foreground">
                {t.categories.inactive}
              </span>
            )}
            {item.childCount > 0 && (
              <span className="text-muted-foreground text-xs">
                {t.categories.deleteChildCount(item.childCount)}
              </span>
            )}
          </div>
          {item.description && (
            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-sm">
              {item.description}
            </p>
          )}
          <p className="text-muted-foreground mt-0.5 text-xs">
            {item.categoryType === "PRODUCTS"
              ? t.categories.offeringProducts
              : item.categoryType === "SERVICES"
                ? t.categories.offeringServices
                : t.categories.offeringBoth}
            {" · "}
            {t.categories.deleteProductCount(item.productCount)} ·{" "}
            {t.categories.deleteServiceCount(item.serviceCount)}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <Button size="icon" variant="ghost" title="Vzgor" disabled={pending} onClick={() => move(item, -1)}>
            <ChevronUpIcon size={16} />
          </Button>
          <Button size="icon" variant="ghost" title="Navzdol" disabled={pending} onClick={() => move(item, 1)}>
            <ChevronDownIcon size={16} />
          </Button>
          <Button size="icon" variant="ghost" title={t.categories.toggleActive} disabled={pending} onClick={() => toggleActive(item)}>
            <Switch checked={item.isActive} onCheckedChange={() => toggleActive(item)} />
          </Button>
          <Button size="icon" variant="ghost" title={t.categories.edit} disabled={pending} onClick={() => openEdit(item)}>
            <PencilIcon size={16} />
          </Button>
          <Button size="icon" variant="ghost" title={t.categories.addSubcategory} disabled={pending} onClick={() => openCreate(item.id)}>
            <PlusIcon size={16} />
          </Button>
          <Button size="icon" variant="ghost" title={t.categories.delete} disabled={pending} onClick={() => openDelete(item)}>
            <TrashIcon size={16} />
          </Button>
        </div>
      </div>
    ) : null

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon size={16} className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.categories.namePlaceholder}
            className="pl-9"
          />
        </div>
        <Button onClick={() => openCreate(null)}>
          <PlusIcon size={16} className="mr-2" />
          {t.categories.addCategory}
        </Button>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
          <PlusIcon size={40} className="text-muted-foreground" />
          <div>
            <p className="font-medium">{t.categories.emptyTitle}</p>
            <p className="text-muted-foreground text-sm">{t.categories.emptyDesc}</p>
          </div>
          <Button onClick={() => openCreate(null)}>{t.categories.createFirst}</Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          {roots.map((root) => [
            renderRow(root, 0),
            childrenOf(root.id).map((child) => renderRow(child, 1)),
          ]).flat()}
          {items.length > 0 && roots.length === 0 && (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              {t.categories.parentNone}
            </p>
          )}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={mode !== null} onOpenChange={(o) => !o && (setMode(null), setForm(null))}>
        {form && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {mode === "create" ? t.categories.addCategory : t.categories.edit}
              </DialogTitle>
              <DialogDescription>{t.categories.subtitle}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t.categories.nameLabel}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t.categories.namePlaceholder}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t.categories.parentLabel}</Label>
                <Select
                  value={mode === "create" ? (formParent ?? "") : (form.parentId ?? "")}
                  onValueChange={(v) =>
                    mode === "create"
                      ? setFormParent(v === "none" ? null : v)
                      : setForm({ ...form, parentId: v === "none" ? null : v })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t.categories.parentNone} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t.categories.parentNone}</SelectItem>
                    {items
                      .filter((i) => (mode === "edit" ? i.id !== form.id : true))
                      .map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t.categories.typeLabel}</Label>
                <Select
                  value={form.categoryType}
                  onValueChange={(v) =>
                    setForm({ ...form, categoryType: v as CategoryType })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BOTH">{t.categories.typeBoth}</SelectItem>
                    <SelectItem value="PRODUCTS">{t.categories.typeProducts}</SelectItem>
                    <SelectItem value="SERVICES">{t.categories.typeServices}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t.categories.descriptionLabel}</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={t.categories.descriptionPlaceholder}
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t.categories.imageLabel}</Label>
                <Input
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  placeholder={t.categories.imagePlaceholder}
                />
              </div>
              {mode === "edit" && (
                <div className="flex items-center justify-between">
                  <Label>{t.categories.active}</Label>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setMode(null)
                  setForm(null)
                }}
              >
                {t.categories.cancel}
              </Button>
              <Button onClick={submit} disabled={pending || !form.name.trim()}>
                {pending ? t.categories.creating : t.categories.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        {deleteTarget && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t.categories.deleteTitle}</DialogTitle>
              <DialogDescription>{t.categories.deleteConfirm}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <p>{t.categories.deleteWarning}</p>
              {deletePreview && (
                <ul className="text-muted-foreground list-disc pl-5">
                  <li>{t.categories.deleteProductCount(deletePreview.products)}</li>
                  <li>{t.categories.deleteServiceCount(deletePreview.services)}</li>
                  {deletePreview.children > 0 && (
                    <>
                      <li>{t.categories.deleteChildCount(deletePreview.children)}</li>
                      <li className="font-medium text-amber-700">
                        {t.categories.deleteHasChildren}
                      </li>
                    </>
                  )}
                </ul>
              )}
              {deletePreview?.children != null && deletePreview.children > 0 && (
                <label className="flex items-center gap-2">
                  <Switch checked={cascadeChildren} onCheckedChange={setCascadeChildren} />
                  <span>{t.categories.deleteChildrenAsRoot}</span>
                </label>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                {t.categories.cancel}
              </Button>
              <Button
                variant="destructive"
                disabled={pending || (!!deletePreview?.children && !cascadeChildren)}
                onClick={confirmDelete}
              >
                {t.categories.deleteForever}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}