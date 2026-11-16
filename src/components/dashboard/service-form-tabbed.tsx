"use client"

// ============================================================
// SERVICE FORM (Fresha-inspired reorganization 2026-11-15)
// 6 tabs instead of one long form:
//   📋 Basic details    — name, slug, description, category
//   💰 Pricing          — price type, price, duration, deposit
//   👥 Team members     — staff assignment
//   🌐 Online booking   — booking settings
//   🖼️ Images           — service image
//   ⚙️ Settings         — active, featured, advanced
// ============================================================

import { useState, useRef, useActionState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ImageIcon, TrashIcon, PlusIcon, SparkleIcon } from "@/components/icons"
import { SpinnerIcon } from "@/components/icons/spinner-icon"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n/provider"
import {
  createService,
  updateService,
  deleteService,
} from "@/app/actions/services"
import { createCategory } from "@/app/actions/categories"
import {
  categoryPickerMode,
  normalizeCategoryName,
} from "@/lib/dashboard/category-picker"
import {
  createServiceSchema,
  updateServiceSchema,
  type ServiceFormData,
} from "@/lib/validations/service"
import {
  fdStr,
  fdOptStr,
  fdNum,
  fdBool,
  fdStrList,
  zodIssuesToFieldErrors,
} from "@/lib/forms/form-data"
import { generateServiceDescription } from "@/lib/service-description-generator"
import { suggestCategory, suggestPrice } from "@/lib/smart-content-generator"
import { QuickBookingLink } from "@/components/dashboard/quick-booking-link"

interface Category {
  id: string
  name: string
}

interface Staff {
  id: string
  name: string
}

interface ServiceData {
  id: string
  name: string
  slug: string
  description: string | null
  duration: number
  price: number
  imageUrl: string | null
  categoryId: string | null
  isActive: boolean
  isFeatured: boolean
  depositType: string | null
  depositValue: number | null
  staffIds: string[]
}

interface ServiceFormProps {
  categories: Category[]
  staff: Staff[]
  service?: ServiceData
  onSuccess?: () => void
}

export function ServiceForm({ categories, staff, service, onSuccess }: ServiceFormProps) {
  const { t } = useI18n()
  const router = useRouter()
  const isEdit = !!service
  const [activeTab, setActiveTab] = useState("basic")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(service?.imageUrl ?? null)
  const [selectedStaff, setSelectedStaff] = useState<string[]>(service?.staffIds ?? [])
  const [newCategoryName, setNewCategoryName] = useState("")
  const [showNewCategory, setShowNewCategory] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ServiceFormData>({
    defaultValues: {
      name: service?.name ?? "",
      slug: service?.slug ?? "",
      description: service?.description ?? "",
      duration: service?.duration ?? 30,
      price: service?.price ?? 0,
      categoryId: service?.categoryId ?? "",
      isActive: service?.isActive ?? true,
      isFeatured: service?.isFeatured ?? false,
      depositType: (service?.depositType as ServiceFormData["depositType"]) ?? "INHERIT",
      depositValue: service?.depositValue ?? undefined,
    },
  })

  const watchCategoryId = watch("categoryId")
  const watchIsActive = watch("isActive")
  const watchIsFeatured = watch("isFeatured")
  const watchDepositType = watch("depositType")

  const [state, formAction, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      try {
        const data = {
          name: fdStr(formData, "name"),
          slug: fdStr(formData, "slug"),
          description: fdOptStr(formData, "description"),
          duration: fdNum(formData, "duration"),
          price: fdNum(formData, "price"),
          categoryId: fdOptStr(formData, "categoryId"),
          isActive: fdBool(formData, "isActive"),
          isFeatured: fdBool(formData, "isFeatured"),
          depositType: fdOptStr(formData, "depositType") as ServiceFormData["depositType"],
          depositValue: formData.get("depositValue") ? fdNum(formData, "depositValue") : undefined,
          staffIds: fdStrList(formData, "staffIds"),
          imageUrl: fdOptStr(formData, "imageUrl"),
        }

        const schema = isEdit ? updateServiceSchema : createServiceSchema
        const parsed = schema.safeParse(data)
        if (!parsed.success) {
          return { ok: false, fieldErrors: zodIssuesToFieldErrors(parsed.error) }
        }

        const result = isEdit
          ? await updateService(service.id, parsed.data)
          : await createService(parsed.data)

        if (result.success) {
          toast.success(isEdit ? t.services.updateSuccess : t.services.createSuccess)
          router.push("/dashboard/services")
          onSuccess?.()
          return { ok: true }
        }
        toast.error(result.error ?? (isEdit ? t.services.updateFailed : t.services.createFailed))
        return { ok: false }
      } catch (error) {
        console.error("Service form error:", error)
        toast.error(t.services.unexpectedError)
        return { ok: false }
      }
    },
    null
  )

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error(t.services.imageTypeError)
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t.services.imageSizeError)
      return
    }

    const formData = new FormData()
    formData.append("file", file)
    formData.append("type", "service")

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setImageUrl(data.url)
      toast.success(t.services.imageUploadSuccess)
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(t.services.uploadFailed)
    }
  }

  const handleDelete = async () => {
    if (!service) return
    try {
      const result = await deleteService(service.id)
      if (result.success) {
        toast.success(t.services.deleteSuccess)
        router.push("/dashboard/services")
      } else {
        toast.error(result.error ?? t.services.deleteFailed)
      }
    } catch (error) {
      console.error("Delete error:", error)
      toast.error(t.services.unexpectedError)
    }
    setShowDeleteDialog(false)
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    try {
      const result = await createCategory({ name: newCategoryName.trim() })
      if (result.success && result.data?.category) {
        toast.success(t.services.categoryCreated)
        setValue("categoryId", result.data.category.id)
        setShowNewCategory(false)
        setNewCategoryName("")
        router.refresh()
      } else {
        toast.error(result.error ?? t.services.categoryCreateFailed)
      }
    } catch (error) {
      console.error("Create category error:", error)
      toast.error(t.services.unexpectedError)
    }
  }

  const toggleStaff = (staffId: string) => {
    setSelectedStaff((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    )
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="categoryId" value={watchCategoryId ?? ""} />
      <input type="hidden" name="isActive" value={String(watchIsActive)} />
      <input type="hidden" name="isFeatured" value={String(watchIsFeatured)} />
      <input type="hidden" name="depositType" value={watchDepositType ?? "INHERIT"} />
      {imageUrl && <input type="hidden" name="imageUrl" value={imageUrl} />}
      {selectedStaff.map((id) => (
        <input key={id} type="hidden" name="staffIds" value={id} />
      ))}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basic">📋 {t.services.tabBasic}</TabsTrigger>
          <TabsTrigger value="pricing">💰 {t.services.tabPricing}</TabsTrigger>
          <TabsTrigger value="team">👥 {t.services.tabTeam}</TabsTrigger>
          <TabsTrigger value="booking">🌐 {t.services.tabBooking}</TabsTrigger>
          <TabsTrigger value="images">🖼️ {t.services.tabImages}</TabsTrigger>
          <TabsTrigger value="settings">⚙️ {t.services.tabSettings}</TabsTrigger>
        </TabsList>

        {/* BASIC DETAILS */}
        <TabsContent value="basic" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.services.basicDetails}</CardTitle>
              <CardDescription>{t.services.basicDetailsDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">{t.services.nameLabel}</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder={t.services.namePlaceholder}
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="slug">{t.services.slugLabel}</Label>
                <Input
                  id="slug"
                  {...register("slug")}
                  placeholder={t.services.slugPlaceholder}
                  className={errors.slug ? "border-red-500" : ""}
                />
                {errors.slug && (
                  <p className="mt-1 text-sm text-red-500">{errors.slug.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">{t.services.descriptionLabel}</Label>
                <div className="flex items-start gap-2">
                  <Textarea
                    id="description"
                    {...register("description")}
                    placeholder={t.services.descriptionPlaceholder}
                    rows={4}
                    className="flex-1"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const name = watch("name")
                      const categoryId = watch("categoryId")
                      const duration = watch("duration")
                      if (!name) {
                        toast.error("Najprej vnesite ime storitve")
                        return
                      }
                      const desc = generateServiceDescription({
                        name,
                        category: categories.find((c) => c.id === categoryId)?.name,
                        duration: Number(duration) || null,
                      })
                      setValue("description", desc)
                      toast.success("Opis generiran! Uredite po potrebi.")
                    }}
                    title="Generiraj profesionalni opis"
                  >
                    <SparkleIcon size={14} className="mr-1" />
                    Generiraj opis
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const duration = watch("duration")
                      const categoryId = watch("categoryId")
                      if (!duration) {
                        toast.error("Najprej vnesite trajanje")
                        return
                      }
                      const price = suggestPrice(Number(duration), categories.find((c) => c.id === categoryId)?.name)
                      setValue("price", price)
                      toast.success(`Predlagana cena: ${price} €`)
                    }}
                    title="Predlagaj ceno glede na trajanje"
                  >
                    💰 Predlagaj ceno
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const name = watch("name")
                      if (!name) {
                        toast.error("Najprej vnesite ime storitve")
                        return
                      }
                      const suggested = suggestCategory(name)
                      if (suggested) {
                        const cat = categories.find((c) => c.name === suggested)
                        if (cat) {
                          setValue("categoryId", cat.id)
                          toast.success(`Predlagana kategorija: ${suggested}`)
                        }
                      } else {
                        toast.info("Ni jasne kategorije — izberite ročno")
                      }
                    }}
                    title="Predlagaj kategorijo"
                  >
                    📂 Predlagaj kategorijo
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.services.descriptionHint}
                </p>
              </div>

              <div>
                <Label htmlFor="category">{t.services.categoryLabel}</Label>
                <div className="flex gap-2">
                  <Select
                    value={watchCategoryId ?? ""}
                    onValueChange={(value) => setValue("categoryId", value)}
                  >
                    <SelectTrigger id="category" className="flex-1">
                      <SelectValue placeholder={t.services.categoryPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowNewCategory(true)}
                  >
                    <PlusIcon size={16} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRICING & DURATION */}
        <TabsContent value="pricing" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.services.pricingDuration}</CardTitle>
              <CardDescription>{t.services.pricingDurationDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="duration">{t.services.durationLabel}</Label>
                  <Select
                    value={String(watch("duration"))}
                    onValueChange={(value) => setValue("duration", parseInt(value))}
                  >
                    <SelectTrigger id="duration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 75, 90, 105, 120, 150, 180].map((min) => (
                        <SelectItem key={min} value={String(min)}>
                          {min < 60 ? `${min} min` : `${Math.floor(min / 60)} hr${min % 60 ? `, ${min % 60} min` : ""}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="price">{t.services.priceLabel}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      €
                    </span>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register("price")}
                      className="pl-8"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="depositType">{t.services.depositTypeLabel}</Label>
                <Select
                  value={watchDepositType ?? "INHERIT"}
                  onValueChange={(value) => setValue("depositType", value as ServiceFormData["depositType"])}
                >
                  <SelectTrigger id="depositType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INHERIT">{t.services.depositInherit}</SelectItem>
                    <SelectItem value="NONE">{t.services.depositNone}</SelectItem>
                    <SelectItem value="FIXED">{t.services.depositFixed}</SelectItem>
                    <SelectItem value="PERCENT">{t.services.depositPercent}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {watchDepositType && watchDepositType !== "INHERIT" && watchDepositType !== "NONE" && (
                <div>
                  <Label htmlFor="depositValue">
                    {watchDepositType === "FIXED" ? t.services.depositValueFixed : t.services.depositValuePercent}
                  </Label>
                  <Input
                    id="depositValue"
                    type="number"
                    step={watchDepositType === "PERCENT" ? "1" : "0.01"}
                    min="0"
                    {...register("depositValue")}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEAM MEMBERS */}
        <TabsContent value="team" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.services.teamMembers}</CardTitle>
              <CardDescription>{t.services.teamMembersDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {staff.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary-text font-semibold">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{member.name}</p>
                      </div>
                    </div>
                    <Switch
                      checked={selectedStaff.includes(member.id)}
                      onCheckedChange={() => toggleStaff(member.id)}
                    />
                  </div>
                ))}
                {staff.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    {t.services.noStaff}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ONLINE BOOKING */}
        <TabsContent value="booking" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.services.onlineBooking}</CardTitle>
              <CardDescription>{t.services.onlineBookingDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t.services.activeLabel}</Label>
                  <p className="text-sm text-muted-foreground">{t.services.activeDesc}</p>
                </div>
                <Switch
                  checked={watchIsActive}
                  onCheckedChange={(checked) => setValue("isActive", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>{t.services.featuredLabel}</Label>
                  <p className="text-sm text-muted-foreground">{t.services.featuredDesc}</p>
                </div>
                <Switch
                  checked={watchIsFeatured}
                  onCheckedChange={(checked) => setValue("isFeatured", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* IMAGES */}
        <TabsContent value="images" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.services.images}</CardTitle>
              <CardDescription>{t.services.imagesDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {imageUrl ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
                    <Image
                      src={imageUrl}
                      alt={t.services.imageAlt}
                      fill
                      className="object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute right-2 top-2"
                      onClick={() => setImageUrl(null)}
                    >
                      <TrashIcon size={16} />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    <ImageIcon size={32} />
                    <span>{t.services.uploadImage}</span>
                    <span className="text-xs">{t.services.uploadImageHint}</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SETTINGS */}
        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.services.settings}</CardTitle>
              <CardDescription>{t.services.settingsDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Quick Booking Link */}
              {isEdit && service?.slug && (
                <div className="mb-4">
                  <QuickBookingLink
                    serviceName={service.name}
                    serviceSlug={service.slug}
                    orgSlug={""}
                  />
                </div>
              )}

              {isEdit && (
                <div className="border-t pt-4">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <TrashIcon size={16} className="mr-2" />
                    {t.services.deleteConfirm}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Form Actions */}
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/dashboard/services")}>
          {t.services.cancel}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <SpinnerIcon size={16} className="mr-2 animate-spin" />}
          {isEdit ? t.services.saveChanges : t.services.createService}
        </Button>
      </div>

      {/* New Category Dialog */}
      <Dialog open={showNewCategory} onOpenChange={setShowNewCategory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.services.createCategory}</DialogTitle>
            <DialogDescription>{t.services.noCategories}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-category">{t.services.newCategoryLabel}</Label>
              <Input
                id="new-category"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={t.services.newCategoryPlaceholder}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCategory(false)}>
              {t.services.cancel}
            </Button>
            <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim()}>
              {t.services.createCategory}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.services.deleteConfirm}</DialogTitle>
            <DialogDescription>{t.services.deleteConfirm}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {t.services.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t.services.deleteConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
