"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { SpinnerGapIcon } from "@/components/icons"
import { format, addDays } from "date-fns"
import { getAvailableTimeSlots } from "@/app/actions/appointments"
import { TimeSlot } from "@/lib/interfaces"
import type { BookingResource } from "@/app/actions/appointments"
import { useI18n } from "@/lib/i18n/context"
import { getDateFnsLocale } from "@/lib/i18n/date-locale"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DateTimeStepProps {
  selectedStaffId: string
  serviceDuration: number
  selectedDate: Date | undefined
  selectedTime: string
  onSelectDate: (date: Date | undefined) => void
  onSelectTime: (time: string) => void
  maxBookingAdvance: number
  dateError?: string
  timeError?: string
  // E2-7 (G7): optional workspace resources — rendered ONLY when the org
  // profile enables workspace-resources + appointments AND at least one
  // resource exists. Empty for everyone else (no visual change).
  resources?: BookingResource[]
  selectedResourceId?: string | null
  onSelectResource?: (id: string | null) => void
  // #92: izbirni dodatki — checkboxi nad izbiro datuma (spremenijo
  // trajanje → sloti se osvežijo prek serviceDuration).
  addons?: { id: string; name: string; price: number; durationMin: number }[]
  selectedAddonIds?: string[]
  onToggleAddon?: (id: string) => void
}

/** "09:30" → 9. Slots always arrive as salon-local "HH:mm". */
function slotHour(slot: TimeSlot): number {
  return Number.parseInt(slot.time.slice(0, 2), 10)
}

export function DateTimeStep({
  selectedStaffId,
  serviceDuration,
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
  maxBookingAdvance,
  dateError,
  timeError,
  resources = [],
  selectedResourceId = null,
  onSelectResource,
  addons = [],
  selectedAddonIds = [],
  onToggleAddon,
}: DateTimeStepProps) {
  const { t, locale, withBusiness } = useI18n()
  const dfLocale = getDateFnsLocale(locale)
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Load available time slots when staff and date are selected
  useEffect(() => {
    async function loadTimeSlots() {
      if (!selectedStaffId || !selectedDate) {
        setAvailableSlots([])
        return
      }

      setLoadingSlots(true)
      try {
        // Send a plain "yyyy-MM-dd" key — the server interprets it in the
        // salon's timezone (never the server's own clock).
        const dateKey = format(selectedDate, "yyyy-MM-dd")
        const slots = await getAvailableTimeSlots(
          selectedStaffId,
          dateKey,
          serviceDuration,
          selectedResourceId,
          selectedAddonIds
        )
        setAvailableSlots(slots)
      } catch (err) {
        console.error("Error loading time slots:", err)
        setAvailableSlots([])
      } finally {
        setLoadingSlots(false)
      }
    }

    loadTimeSlots()
  }, [selectedStaffId, selectedDate, serviceDuration, selectedResourceId, selectedAddonIds])

  // References group the times instead of pouring every slot into one grid:
  // morning / afternoon / evening read faster and match how customers think
  // about their day. Empty groups never render (no wall of headings).
  const slotGroups = [
    {
      key: "morning" as const,
      label: t.booking.morning,
      slots: availableSlots.filter((slot) => slotHour(slot) < 12),
    },
    {
      key: "afternoon" as const,
      label: t.booking.afternoon,
      slots: availableSlots.filter((slot) => {
        const hour = slotHour(slot)
        return hour >= 12 && hour < 17
      }),
    },
    {
      key: "evening" as const,
      label: t.booking.evening,
      slots: availableSlots.filter((slot) => slotHour(slot) >= 17),
    },
  ].filter((group) => group.slots.length > 0)

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
            3
          </div>
          <CardTitle>{t.booking.pickDateTime}</CardTitle>
        </div>
        <CardDescription>{withBusiness(t.booking.pickDateTimeDesc)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!selectedStaffId ? (
          <p className="text-muted-foreground text-center text-sm">
            {t.booking.pickStaffFirst}
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
            {/* Left column — the day picker and the options that change the
                offered slots (space, add-ons). */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={onSelectDate}
                    disabled={(date) => {
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      const maxDate = addDays(today, maxBookingAdvance)
                      return date < today || date > maxDate
                    }}
                    className="rounded-xl border shadow-sm"
                  />
                </div>
                {dateError && (
                  <p className="text-destructive text-center text-sm lg:text-left">
                    {dateError}
                  </p>
                )}
              </div>

              {/* E2-7 (G7): optional resource differentiator — only when the
                  profile offers workspace resources and at least one exists. */}
              {resources.length > 0 && onSelectResource && (
                <div className="space-y-2">
                  <Label htmlFor="booking-resource" className="block text-sm font-medium">
                    {t.booking.resourceLabel}
                  </Label>
                  <Select
                    value={selectedResourceId ?? "none"}
                    onValueChange={(v) => onSelectResource(v === "none" ? null : v)}
                  >
                    <SelectTrigger id="booking-resource" className="w-full sm:w-72">
                      <SelectValue placeholder={t.booking.resourcePlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t.booking.resourceNone}</SelectItem>
                      {resources.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {/* P2 #15 (audit-2026-11): samo ime — "Stol 1 — Stol"
                              ponavlja vrsto, ki jo stranki ni treba videti. */}
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">{t.booking.resourceNote}</p>
                </div>
              )}

              {/* #92: izbirni dodatki — cena in trajanje se prištejeta
                  atomarno (Sloti se osvežijo, cena je vidna v povzetku PRED
                  potrditvijo). Nič ni izbrano privzeto. */}
              {addons.length > 0 && onToggleAddon && (
                <div className="space-y-2">
                  <Label className="block text-sm font-medium">{t.booking.addonsTitle}</Label>
                  <div className="flex flex-wrap gap-2">
                    {addons.map((addon) => {
                      const checked = selectedAddonIds.includes(addon.id)
                      return (
                        <button
                          key={addon.id}
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          onClick={() => onToggleAddon(addon.id)}
                          className={cn(
                            "focus-visible:ring-ring rounded-full border px-4 py-1.5 text-sm transition-all focus-visible:ring-2 focus-visible:outline-none",
                            checked
                              ? "border-primary bg-primary/5 ring-primary/30 ring-2"
                              : "hover:border-primary/40"
                          )}
                        >
                          {addon.name}
                          <span className="text-muted-foreground ml-1.5 text-xs">
                            +{addon.price.toFixed(2).replace(".", ",")} €
                            {addon.durationMin > 0 ? ` · +${addon.durationMin} min` : ""}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right column — the times for the picked day, grouped by part
                of the day. Unavailable slots stay visible (struck through) so
                the customer sees the day is busy, not broken. */}
            <div className="space-y-4">
              {!selectedDate ? (
                <div className="text-muted-foreground flex min-h-32 items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm">
                  {t.booking.pickDateFirst}
                </div>
              ) : (
                <>
                  <Label className="block text-base font-semibold">
                    {t.booking.slotsFor(
                      format(
                        selectedDate,
                        locale === "sl" ? "d. MMMM yyyy" : "MMMM d, yyyy",
                        { locale: dfLocale }
                      )
                    )}
                  </Label>

                  {loadingSlots ? (
                    <div className="flex justify-center py-8">
                      <SpinnerGapIcon
                        size={32}
                        className="text-primary-text animate-spin"
                        weight="regular"
                      />
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="space-y-2 py-6 text-center">
                      <p className="text-muted-foreground">{t.booking.noSlots}</p>
                      {/* #90: pošten izhod — če je dan poln, ponudimo
                          prijavo na čakalno listo (kartica je na isti strani). */}
                      <a
                        href="#waitlist"
                        className="text-primary-text text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {t.booking.waitlistHint}
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {slotGroups.map((group) => (
                        <div key={group.key} className="space-y-2">
                          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                            {group.label}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {group.slots.map((slot) => {
                              const isSelected = selectedTime === slot.time
                              return (
                                <button
                                  key={slot.time}
                                  type="button"
                                  onClick={() => slot.available && onSelectTime(slot.time)}
                                  disabled={!slot.available}
                                  aria-pressed={isSelected}
                                  className={cn(
                                    "min-w-20 rounded-xl border px-3 py-2 text-sm font-medium tabular-nums transition-colors",
                                    isSelected
                                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                      : slot.available
                                        ? "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
                                        : "border-border/60 bg-muted/40 text-muted-foreground line-through opacity-60"
                                  )}
                                >
                                  {slot.formattedTime}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {timeError && <p className="text-destructive text-sm">{timeError}</p>}
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
